$source = "C:\Users\juanf\Downloads\Analog Engineer's Pocket Reference.pdf"
$dest = "C:\Users\juanf\Desktop\Claude\EE_learning\split_pdfs\Analog_Pocket_Reference\temp_analog_reference.pdf"
New-Item -ItemType Directory -Force -Path (Split-Path $dest)
Copy-Item -Path $source -Destination $dest -Force
Write-Host "File copied successfully to: $dest"
