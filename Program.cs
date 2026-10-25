using Microsoft.AspNetCore.StaticFiles;

var builder = WebApplication.CreateBuilder(args);

                                                                        
builder.Services.AddRazorPages();

var app = builder.Build();

if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Error");
    app.UseHsts();
    app.UseHttpsRedirection();
}

                                                                        
                                                                      
                                                              
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
