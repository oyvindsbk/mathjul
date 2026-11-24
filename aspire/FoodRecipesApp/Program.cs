var builder = DistributedApplication.CreateBuilder(args);

// Add SQL Server using Azure SQL Edge for ARM64/Apple Silicon compatibility
var sqlPassword = builder.AddParameter("sql-password", secret: true);

var sqlServer = builder
    .AddSqlServer("sqlserver", password: sqlPassword)
    .WithImageRegistry("mcr.microsoft.com")
    .WithImage("azure-sql-edge")
    .WithImageTag("latest")
    .WithDataVolume("sqlserver-data")
    .WithEndpoint(port: 1433, targetPort: 1433, name: "sql", scheme: "tcp", isProxied: false);

var recipeDb = sqlServer.AddDatabase("recipedb");

// Add the backend API project with database reference
var recipeApi = builder.AddProject<Projects.RecipeApi>("recipeapi")
    .WithReference(recipeDb)
    .WithEnvironment("ASPNETCORE_ENVIRONMENT", "Development")
    // /health answers only after startup has recreated and migrated the database, so
    // resources that WaitFor(recipeApi) don't race the drop.
    .WithHttpHealthCheck("/health");

// Add the frontend project in development mode
var frontend = builder.AddJavaScriptApp("frontend", "../../frontend", "dev")
    .WithReference(recipeApi)
    .WithHttpEndpoint(env: "PORT")
    .WithExternalHttpEndpoints();

// Notater: same database, own "notes" schema. Waits for RecipeApi because RecipeApi drops and
// recreates the whole local database on startup; NotesApi then migrates its schema.
var notesApi = builder.AddProject<Projects.NotesApi>("notesapi")
    .WithReference(recipeDb)
    .WaitFor(recipeApi)
    .WithEnvironment("ASPNETCORE_ENVIRONMENT", "Development")
    // Local-only values (appsettings.Development.json is gitignored in this repo).
    .WithEnvironment("Jwt__SecretKey", "local-dev-notes-secret-key-at-least-32-bytes!")
    .WithEnvironment("Notes__AllowedEmails", "dev@example.com")
    .WithEnvironment("Notes__DevEmail", "dev@example.com")
    .WithHttpHealthCheck("/health");

builder.AddJavaScriptApp("frontend-notes", "../../frontend-notes", "dev")
    .WithEnvironment("NOTES_API_URL", notesApi.GetEndpoint("http"))
    .WithEnvironment("APP_URL", "http://localhost:3100")
    .WaitFor(notesApi)
    .WithHttpEndpoint(port: 3100, env: "PORT") // fixed so Playwright and bookmarks can find it
    .WithExternalHttpEndpoints();

builder.Build().Run();
