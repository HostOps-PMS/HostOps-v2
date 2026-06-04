import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';

export default function ImageCropModal({ imageUrl, initialCropData, onClose, onSave }) {
  const [crop, setCrop] = useState(initialCropData?.crop || { x: 0, y: 0 });
  const [zoom, setZoom] = useState(initialCropData?.zoom || 1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(initialCropData?.croppedAreaPixels || null);

  const onCropComplete = useCallback((croppedArea, cap) => {
    setCroppedAreaPixels(cap);
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
      const data = ctx.getImageData(pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height);
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
      const previewBlob = await getCroppedImg(imageUrl, croppedAreaPixels);
      onSave(cropData, previewBlob);
    } catch (e) {
      console.error(e);
      alert('Failed to process image');
    }
  };

  const zoomPercent = Math.round(((zoom - 1) / 2) * 100);

  return (
    <div className="db-modal-overlay" style={{ zIndex: 9999 }}>
      <div
        className="db-modal"
        style={{
          width: 520,
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '16px',
          overflow: 'hidden',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        {/* Header */}
        <div
          className="db-modal__head"
          style={{
            padding: '18px 22px',
            borderBottom: '1px solid var(--color-border, #e5e9ec)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: '8px',
                background: 'var(--color-brand, #26a676)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                flexShrink: 0,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="4" y1="6" x2="20" y2="6" />
                <line x1="4" y1="12" x2="20" y2="12" />
                <line x1="4" y1="18" x2="20" y2="18" />
                <circle cx="14" cy="6" r="2" fill="currentColor" stroke="none" />
                <circle cx="8" cy="12" r="2" fill="currentColor" stroke="none" />
                <circle cx="14" cy="18" r="2" fill="currentColor" stroke="none" />
              </svg>
            </div>
            <div>
              <div style={{ fontSize: '.9375rem', fontWeight: 700, color: 'var(--color-text)', lineHeight: 1.2 }}>
                Adjust Picture
              </div>
              <div style={{ fontSize: '.7rem', color: 'var(--color-muted)', marginTop: 1 }}>
                Drag and Scroll
              </div>
            </div>
          </div>
          <button
            className="db-modal__close"
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--color-surface-2, #f0f4f2)',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--color-muted)',
              fontSize: '1rem',
              transition: 'background .15s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-border, #e5e9ec)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'var(--color-surface-2, #f0f4f2)'}
          >
            ✕
          </button>
        </div>

        {/* Cropper area */}
        <div
          style={{
            position: 'relative',
            height: 380,
            background: '#111',
          }}
        >
          <Cropper
            image={imageUrl}
            crop={crop}
            zoom={zoom}
            aspect={1}
            onCropChange={setCrop}
            onCropComplete={onCropComplete}
            onZoomChange={setZoom}
            style={{
              containerStyle: { background: '#111' },
              cropAreaStyle: {
                border: '2px solid rgba(255,255,255,0.9)',
                boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)',
              },
            }}
          />
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 22px',
            borderTop: '1px solid var(--color-border, #e5e9ec)',
            background: 'var(--color-surface, #fff)',
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          {/* Zoom row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Zoom out icon */}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-muted)" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}>
              <circle cx="11" cy="11" r="7" />
              <line x1="8" y1="11" x2="14" y2="11" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>

            {/* Slider */}
            <div style={{ flex: 1, position: 'relative' }}>
              <input
                type="range"
                value={zoom}
                min={1}
                max={3}
                step={0.01}
                onChange={(e) => setZoom(Number(e.target.value))}
                style={{
                  width: '100%',
                  height: 4,
                  appearance: 'none',
                  WebkitAppearance: 'none',
                  background: `linear-gradient(to right, var(--color-brand, #26a676) 0%, var(--color-brand, #26a676) ${zoomPercent}%, var(--color-border, #e0e7e4) ${zoomPercent}%, var(--color-border, #e0e7e4) 100%)`,
                  borderRadius: 99,
                  cursor: 'pointer',
                  outline: 'none',
                  border: 'none',
                  margin: 0,
                }}
              />
              <style>{`
                input[type=range]::-webkit-slider-thumb {
                  -webkit-appearance: none;
                  width: 18px;
                  height: 18px;
                  border-radius: 50%;
                  background: white;
                  border: 2px solid var(--color-brand, #26a676);
                  cursor: pointer;
                  box-shadow: 0 1px 4px rgba(0,0,0,0.15);
                  transition: transform .15s;
                }
                input[type=range]::-webkit-slider-thumb:hover {
                  transform: scale(1.15);
                }
                input[type=range]::-moz-range-thumb {
                  width: 18px;
                  height: 18px;
                  border-radius: 50%;
                  background: white;
                  border: 2px solid var(--color-brand, #26a676);
                  cursor: pointer;
                  box-shadow: 0 1px 4px rgba(0,0,0,0.15);
                }
              `}</style>
            </div>

            {/* Zoom in icon */}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-muted)" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}>
              <circle cx="11" cy="11" r="7" />
              <line x1="8" y1="11" x2="14" y2="11" />
              <line x1="11" y1="8" x2="11" y2="14" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>

            {/* Zoom % badge */}
            <div
              style={{
                minWidth: 44,
                textAlign: 'center',
                fontSize: '.75rem',
                fontWeight: 700,
                color: 'var(--color-brand, #26a676)',
                background: 'rgba(38, 166, 118, 0.08)',
                borderRadius: '6px',
                padding: '3px 8px',
                flexShrink: 0,
              }}
            >
              {zoomPercent}%
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button
              className="db-btn db-btn--ghost"
              onClick={onClose}
              style={{ minWidth: 90 }}
            >
              Cancel
            </button>
            <button
              className="db-btn db-btn--primary"
              onClick={handleSave}
              style={{
                minWidth: 110,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Apply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}