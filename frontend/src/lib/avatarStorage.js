const keyFor = (email) => `cc_avatar_${(email || 'guest').toLowerCase()}`;

export function getAvatar(email) {
  try {
    return localStorage.getItem(keyFor(email)) || '';
  } catch {
    return '';
  }
}

export function setAvatar(email, dataUrl) {
  try {
    if (dataUrl) {
      localStorage.setItem(keyFor(email), dataUrl);
    } else {
      localStorage.removeItem(keyFor(email));
    }
    window.dispatchEvent(new CustomEvent('cc-avatar-updated', { detail: { email } }));
  } catch {
    throw new Error('Could not save image in browser storage.');
  }
}

export function resizeImageToDataUrl(file, maxSize = 192) {
  return new Promise((resolve, reject) => {
    if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      reject(new Error('Please choose a JPG, PNG, or WebP image.'));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      reject(new Error('Image must be 5 MB or smaller.'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the selected image.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image file.'));
      img.onload = () => {
        const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}