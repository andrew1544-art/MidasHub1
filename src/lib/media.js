// Compress image before upload — reduces 5MB phone photo to ~200KB
export function compressImage(file, maxWidth = 1920, quality = 0.8) {
  return new Promise((resolve) => {
    // Skip if already small or not an image
    if (!file.type.startsWith('image/') || file.size < 100000) {
      resolve(file);
      return;
    }
    const img = new Image();
    img.onload = () => {
      let w = img.width, h = img.height;
      if (w > maxWidth) { h = (h * maxWidth) / w; w = maxWidth; }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob((blob) => {
        if (blob && blob.size < file.size) {
          resolve(new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() }));
        } else {
          resolve(file); // Original was smaller, keep it
        }
      }, 'image/jpeg', quality);
    };
    img.onerror = () => resolve(file);
    img.src = URL.createObjectURL(file);
  });
}

// Check video size — warn if too large
export function checkVideoSize(file, maxMB = 50) {
  const sizeMB = file.size / (1024 * 1024);
  if (sizeMB > maxMB) {
    return { ok: false, sizeMB: sizeMB.toFixed(1), maxMB };
  }
  return { ok: true, sizeMB: sizeMB.toFixed(1) };
}

// Format file size for display
export function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}
