// Downscales/compresses an image file in the browser (via <canvas>) and
// resolves to a JPEG "data:image/jpeg;base64,..." string, small enough to
// comfortably clear the server's 2MB decoded-size cap (see
// user.service.js updateOwnPhoto) even for a multi-MB phone-camera photo.
// Used by the click-the-avatar-to-upload profile photo feature — we save
// the photo inline as base64 rather than through the disk-based upload
// system, so there's no reason to keep the original at full resolution.
export function resizeImageToBase64(file, { maxDim = 512, quality = 0.85 } = {}) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the selected file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('That file doesn\'t look like a valid image.'));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width >= height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
