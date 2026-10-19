DocLib v1.35.4-preview.1

PARTIAL IMPLEMENTATION: automatic upload, folder creation, and atomic conflict protection are NOT implemented. No write requests are made to Trimble Connect.

Built from actual v1.35.3.2 baseline. Replace app.js, index.html, manifest.json using files in this ZIP.

Select a personal profile, click Forbered prosjektprofil, choose new/update, name and optional default. Download package. It contains the new profile and updated manifest, preserving other manifest entries. Upload manually, profile first, manifest last. Use Kontroller opplastede filer to compare both files.

The dialog reads the current project manifest. Invalid or inaccessible configuration stops preparation. Existing project files are never deleted. Manual uploads are not concurrency-safe.

Not tested in an authenticated Trimble Connect project.
