#!/usr/bin/env bash
# Runs in infrastructure.yml before Bicep. Reads what is live so the deploy keeps it, and
# refuses to deploy when the template would break a running app.
#
#   - Running image of each app -> $GITHUB_OUTPUT (<app>-image). Empty when the app is missing,
#     and main.bicep then uses the placeholder.
#   - Recipe frontend ingress URL -> $GITHUB_OUTPUT (frontend-fqdn-url), for the API's CORS.
#   - Guard: a bound custom domain would be removed, renamed or lose its certificate because
#     a variable is empty or different (ARM replaces the ingress block wholesale).
#   - Guard: the recipe API exists but would be left with no CORS origin.
#
# Env: RG, FRONTEND_CUSTOM_DOMAIN, FRONTEND_CUSTOM_DOMAIN_CERT, FRONTEND_URL,
#      NOTES_ENABLED (true|false), NOTES_CUSTOM_DOMAIN, NOTES_CUSTOM_DOMAIN_CERT
set -uo pipefail

: "${RG:?RG is required}"
: "${GITHUB_OUTPUT:=/dev/null}"
: "${GITHUB_STEP_SUMMARY:=/dev/null}"
FRONTEND_CUSTOM_DOMAIN="${FRONTEND_CUSTOM_DOMAIN:-}"
FRONTEND_CUSTOM_DOMAIN_CERT="${FRONTEND_CUSTOM_DOMAIN_CERT:-}"
FRONTEND_URL="${FRONTEND_URL:-}"
NOTES_ENABLED="${NOTES_ENABLED:-false}"
NOTES_CUSTOM_DOMAIN="${NOTES_CUSTOM_DOMAIN:-}"
NOTES_CUSTOM_DOMAIN_CERT="${NOTES_CUSTOM_DOMAIN_CERT:-}"

ERRORS=0
fail() { echo "::error::$1"; ERRORS=$((ERRORS + 1)); }

find_app() {
  az containerapp list -g "$RG" --query "[?contains(name, '$1')].name | [0]" -o tsv 2>/dev/null | tr -d '\r'
}

show() { # app, JMESPath query
  az containerapp show -n "$1" -g "$RG" --query "$2" -o tsv 2>/dev/null | tr -d '\r'
}

# Fails when the live bindings of $app would not survive the template's customDomains.
check_domains() { # app, wanted domain, wanted cert, domain var name, cert var name
  local app="$1" want_domain="$2" want_cert="$3" domain_var="$4" cert_var="$5"
  local name binding cert_id live_cert
  while IFS=$'\t' read -r name binding cert_id; do
    [ -z "$name" ] && continue
    if [ "$name" != "$want_domain" ]; then
      fail "$app has custom domain '$name' bound, and this deploy would remove it. Set $domain_var=$name (now '${want_domain}')."
      continue
    fi
    if [ "$binding" = "SniEnabled" ]; then
      live_cert="${cert_id##*/}"
      if [ "$want_cert" != "$live_cert" ]; then
        fail "$app serves '$name' with certificate '$live_cert', and this deploy would change that. Set $cert_var=$live_cert (now '${want_cert}')."
      fi
    fi
  done < <(show "$app" "properties.configuration.ingress.customDomains[].[name, bindingType, certificateId]")
}

declare -A IMAGES
for key in recipe-api recipe-web notes-api notes-web; do
  IMAGES[$key]=""
done

RECIPE_API=$(find_app recipe-api)
RECIPE_WEB=$(find_app recipe-web)
[ -n "$RECIPE_API" ] && IMAGES[recipe-api]=$(show "$RECIPE_API" "properties.template.containers[0].image")

FRONTEND_FQDN_URL=""
if [ -n "$RECIPE_WEB" ]; then
  IMAGES[recipe-web]=$(show "$RECIPE_WEB" "properties.template.containers[0].image")
  FQDN=$(show "$RECIPE_WEB" "properties.configuration.ingress.fqdn")
  [ -n "$FQDN" ] && FRONTEND_FQDN_URL="https://$FQDN"
  check_domains "$RECIPE_WEB" "$FRONTEND_CUSTOM_DOMAIN" "$FRONTEND_CUSTOM_DOMAIN_CERT" \
    FRONTEND_CUSTOM_DOMAIN FRONTEND_CUSTOM_DOMAIN_CERT
fi

if [ -n "$RECIPE_API" ] && [ -z "$FRONTEND_CUSTOM_DOMAIN$FRONTEND_URL$FRONTEND_FQDN_URL" ]; then
  fail "$RECIPE_API would be left with no CORS origin, so the frontend could not call it. Set FRONTEND_CUSTOM_DOMAIN or FRONTEND_URL."
fi

# Bicep leaves the Notater apps alone when Notater is off, so there is nothing to keep then.
if [ "$NOTES_ENABLED" = "true" ]; then
  NOTES_API=$(find_app notes-api)
  NOTES_WEB=$(find_app notes-web)
  [ -n "$NOTES_API" ] && IMAGES[notes-api]=$(show "$NOTES_API" "properties.template.containers[0].image")
  if [ -n "$NOTES_WEB" ]; then
    IMAGES[notes-web]=$(show "$NOTES_WEB" "properties.template.containers[0].image")
    check_domains "$NOTES_WEB" "$NOTES_CUSTOM_DOMAIN" "$NOTES_CUSTOM_DOMAIN_CERT" \
      NOTES_CUSTOM_DOMAIN NOTES_CUSTOM_DOMAIN_CERT
  fi
fi

{
  for key in recipe-api recipe-web notes-api notes-web; do
    echo "$key-image=${IMAGES[$key]}"
  done
  echo "frontend-fqdn-url=$FRONTEND_FQDN_URL"
} >> "$GITHUB_OUTPUT"

{
  echo "### Infrastructure preflight"
  echo ""
  echo "| App | Image kept |"
  echo "|---|---|"
  for key in recipe-api recipe-web notes-api notes-web; do
    echo "| $key | \`${IMAGES[$key]:-placeholder (new app)}\` |"
  done
  echo ""
  echo "Frontend ingress: \`${FRONTEND_FQDN_URL:-none}\`"
} >> "$GITHUB_STEP_SUMMARY"

if [ "$ERRORS" -gt 0 ]; then
  echo "Preflight found $ERRORS problem(s). Nothing was deployed. See DEPLOYMENT.md, 'Variables and secrets'."
  exit 1
fi
echo "Preflight OK."
