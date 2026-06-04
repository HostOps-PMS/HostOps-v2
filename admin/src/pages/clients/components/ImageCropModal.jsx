import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';

export default function ImageCropModal({ imageUrl, initialCropData, onClose, onSave }) {
  const [crop, setCrop] = useState(initialCropData?.crop || { x: 0, y: 0 });
  const [zoom, setZoom] = useState(initialCropData?.zoom || 1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(initialCropData?.croppedAreaPixels || null);

  const onCropComplete = useCallback((croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const createImage = (url) =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.addEventListener('load', () => resolve(image));
      image.addEventListener('error', (error) => reject(error));
      image.setAttribute('crossOrigin', 'anonymous');
      image.src = url;
    });

  const getCroppedImg = async (imageSrc, pixelCrop) => {
    try {
      const image = await createImage(imageSrc);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) return null;

      canvas.width = image.width;
      canvas.height = image.height;
      ctx.drawImage(image, 0, 0);

      const data = ctx.getImageData(
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height
      );

      canvas.width = pixelCrop.width;
      canvas.height = pixelCrop.height;
      ctx.putImageData(data, 0, 0);

      return new Promise((resolve) => {
        canvas.toBlob((file) => resolve(file), 'image/jpeg');
      });
    } catch (e) {
      console.error(e);
      return null;
    }
  };

  const handleSave = async () => {
    try {
      const cropData = { crop, zoom, croppedAreaPixels };
      // Generate a preview blob for local UI display immediately
      const previewBlob = await getCroppedImg(imageUrl, croppedAreaPixels);
      onSave(cropData, previewBlob);
    } catch (e) {
      console.error(e);
      alert('Failed to process image');
    }
  };

  return (
    <div className="db-modal-overlay" style={{ zIndex: 9999 }}>
      <div className="db-modal" style={{ width: 500, display: 'flex', flexDirection: 'column' }}>
        <div className="db-modal__head">
          <span className="db-modal__title">Adjust Picture</span>
          <button className="db-modal__close" onClick={onClose}>✕</button>
        </div>
        <div className="db-modal__body" style={{ position: 'relative', height: 400, background: '#e5e9ec' }}>
          <Cropper
            image={imageUrl}
            crop={crop}
            zoom={zoom}
            aspect={1}
            onCropChange={setCrop}
            onCropComplete={onCropComplete}
            onZoomChange={setZoom}
          />
        </div>
        <div className="db-modal__foot" style={{ padding: '16px 20px', display: 'flex', gap: 12 }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--color-muted)', fontWeight: 600 }}>Zoom</span>
            <input
              type="range"
              value={zoom}
              min={1}
              max={3}
              step={0.1}
              aria-labelledby="Zoom"
              onChange={(e) => setZoom(e.target.value)}
              style={{ flex: 1 }}
            />
          </div>
          <button className="db-btn db-btn--ghost" onClick={onClose}>Cancel</button>
          <button className="db-btn db-btn--primary" onClick={handleSave}>Confirm</button>
        </div>
      </div>
    </div>
  );
}
