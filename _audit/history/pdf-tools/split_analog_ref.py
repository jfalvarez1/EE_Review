"""
Split the Analog Engineer's Pocket Reference PDF
"""
import os
from pathlib import Path

try:
    from PyPDF2 import PdfReader, PdfWriter
except ImportError:
    os.system("pip install PyPDF2")
    from PyPDF2 import PdfReader, PdfWriter

# Find the file in Downloads
downloads = Path(r"C:\Users\juanf\Downloads")
output_folder = Path(r"C:\Users\juanf\Desktop\Claude\EE_learning\split_pdfs\Analog_Pocket_Reference")

# Find the Analog Engineer's Pocket Reference file
for f in downloads.iterdir():
    if "Analog Engineer" in f.name and f.suffix.lower() == ".pdf":
        print(f"Found file: {f}")

        reader = PdfReader(str(f))
        total_pages = len(reader.pages)
        print(f"Total pages: {total_pages}")

        pages_per_chunk = 25
        chunk_num = 1
        start_page = 0

        while start_page < total_pages:
            end_page = min(start_page + pages_per_chunk, total_pages)

            writer = PdfWriter()
            for page_num in range(start_page, end_page):
                writer.add_page(reader.pages[page_num])

            output_path = output_folder / f"Analog_Pocket_Reference_part{chunk_num:02d}_pages{start_page+1}-{end_page}.pdf"

            with open(output_path, "wb") as output_file:
                writer.write(output_file)

            print(f"Created: {output_path.name}")

            chunk_num += 1
            start_page = end_page

        print(f"Successfully split into {chunk_num - 1} parts")
        break
else:
    print("Could not find Analog Engineer's Pocket Reference PDF")
