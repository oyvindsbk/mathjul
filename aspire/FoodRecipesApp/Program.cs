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
    .WithReference(recipeDb);

// Add the frontend project in development mode
var frontend = builder.AddNpmApp("frontend", "../../frontend", "dev")
    .WithReference(recipeApi)
    .WithHttpEndpoint(env: "PORT")
    .WithExternalHttpEndpoints();

builder.Build().Run();
