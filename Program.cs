using Microsoft.AspNetCore.StaticFiles;

var builder = WebApplication.CreateBuilder(args);

// Razor Pages предоставляют главное меню, конструктор и игровые экраны.
builder.Services.AddRazorPages();

var app = builder.Build();

if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Error");
    app.UseHsts();
    app.UseHttpsRedirection();
}

// ASP.NET Core не знает MIME-тип .glb из коробки во всех конфигурациях.
// Без этой регистрации Static File Middleware может вернуть HTTP 404,
// даже если wwwroot/assets/models/frame-light.glb существует.
var contentTypeProvider = new FileExtensionContentTypeProvider();
contentTypeProvider.Mappings[".glb"] = "model/gltf-binary";
contentTypeProvider.Mappings[".gltf"] = "model/gltf+json";
contentTypeProvider.Mappings[".bin"] = "application/octet-stream";

app.UseStaticFiles(new StaticFileOptions
{
    ContentTypeProvider = contentTypeProvider
});

app.UseRouting();
app.MapRazorPages();

app.Run();
