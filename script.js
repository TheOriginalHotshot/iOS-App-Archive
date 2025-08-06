document.addEventListener('DOMContentLoaded', () => {
  fetchUploads();
});

async function fetchUploads() {
  try {
    // Fetch all items uploaded by @legacyios_archive
    const response = await fetch('https://archive.org/advancedsearch.php?q=uploader:@legacyios_archive&output=json&rows=100');
    const data = await response.json();
    const docs = data.response.docs;
    const fileList = document.getElementById('file-list');
    
    // Check if there are any uploads
    if (docs.length === 0) {
      fileList.innerHTML = '<p>No uploads found.</p>';
      return;
    }

    fileList.innerHTML = '';
    const ipaFiles = [];

    // For each uploaded item, fetch its files and filter for .ipa files
    for (const doc of docs) {
      const identifier = doc.identifier;
      const filesResponse = await fetch(`https://archive.org/metadata/${identifier}/files`);
      const filesData = await filesResponse.json();
      const files = filesData.result.filter(file => file.name.endsWith('.ipa'));
      
      files.forEach(file => {
        ipaFiles.push({ name: file.name, identifier });
      });
    }

    // Check if any IPA files were found
    if (ipaFiles.length === 0) {
      fileList.innerHTML = '<p>No IPA files found in your uploads.</p>';
    } else {
      // Display each IPA file with a download link
      ipaFiles.forEach(file => {
        const li = document.createElement('li');
        const link = document.createElement('a');
        link.href = `https://archive.org/download/${file.identifier}/${encodeURIComponent(file.name)}`;
        link.textContent = file.name;
        link.download = file.name; // Encourages direct download
        li.appendChild(link);
        fileList.appendChild(li);
      });
    }
  } catch (error) {
    document.getElementById('file-list').innerHTML = '<p>Error loading files. Please try again later.</p>';
    console.error('Error fetching uploads:', error);
  }
}

// Add real-time search functionality
document.getElementById('search').addEventListener('input', function() {
  const query = this.value.toLowerCase();
  const fileElements = document.querySelectorAll('#file-list li');
  fileElements.forEach(el => {
    const name = el.textContent.toLowerCase();
    el.style.display = name.includes(query) ? '' : 'none';
  });
});
