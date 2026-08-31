"""
PDF Splitter Script for Large Technical Documents
Splits PDFs into smaller chunks of specified page count for easier processing.
"""

import os
import sys

try:
    from PyPDF2 import PdfReader, PdfWriter
except ImportError:
    print("PyPDF2 not installed. Installing...")
    os.system("pip install PyPDF2")
    from PyPDF2 import PdfReader, PdfWriter

def split_pdf(input_path, output_folder, pages_per_chunk=30):
    """
    Split a PDF into multiple smaller PDFs.

    Args:
        input_path: Path to the source PDF
        output_folder: Directory to save the split PDFs
        pages_per_chunk: Number of pages per output file
    """
    print(f"Processing: {input_path}")

    if not os.path.exists(input_path):
        print(f"  ERROR: File not found: {input_path}")
        return

    # Create output folder if it doesn't exist
    os.makedirs(output_folder, exist_ok=True)

    # Get base name for output files
    base_name = os.path.splitext(os.path.basename(input_path))[0]
    # Clean up the name for better file naming
    base_name = base_name.replace(" ", "_").replace("'", "")[:50]

    try:
        reader = PdfReader(input_path)
        total_pages = len(reader.pages)
        print(f"  Total pages: {total_pages}")

        chunk_num = 1
        start_page = 0

        while start_page < total_pages:
            end_page = min(start_page + pages_per_chunk, total_pages)

            writer = PdfWriter()
            for page_num in range(start_page, end_page):
                writer.add_page(reader.pages[page_num])

            output_path = os.path.join(
                output_folder,
                f"{base_name}_part{chunk_num:02d}_pages{start_page+1}-{end_page}.pdf"
            )

            with open(output_path, "wb") as output_file:
                writer.write(output_file)

            print(f"  Created: {os.path.basename(output_path)} ({end_page - start_page} pages)")

            chunk_num += 1
            start_page = end_page

        print(f"  Successfully split into {chunk_num - 1} parts\n")

    except Exception as e:
        print(f"  ERROR processing file: {e}")

def main():
    base_output = r"C:\Users\juanf\Desktop\Claude\EE_learning\split_pdfs"

    # Define the PDFs to split and their output folders
    pdfs_to_split = [
        {
            "input": r"C:\Users\juanf\Downloads\The_Art_of_Electronics_3rd_edition.pdf",
            "output": os.path.join(base_output, "Art_of_Electronics"),
            "pages_per_chunk": 50  # Larger book, bigger chunks
        },
        {
            "input": r"C:\Users\juanf\Downloads\Analog Engineer's Pocket Reference.pdf",
            "output": os.path.join(base_output, "Analog_Pocket_Reference"),
            "pages_per_chunk": 25  # Smaller reference, smaller chunks
        },
        {
            "input": r"C:\Users\juanf\Downloads\TI-Analog Engineers circuit cook book slyy138.pdf",
            "output": os.path.join(base_output, "TI_Cookbook"),
            "pages_per_chunk": 30  # Medium size chunks
        }
    ]

    print("=" * 60)
    print("PDF Splitter for Analog Electronics Learning Materials")
    print("=" * 60 + "\n")

    for pdf_config in pdfs_to_split:
        split_pdf(
            pdf_config["input"],
            pdf_config["output"],
            pdf_config["pages_per_chunk"]
        )

    print("=" * 60)
    print("Splitting complete!")
    print("=" * 60)

if __name__ == "__main__":
    main()
