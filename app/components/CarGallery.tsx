'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';

interface CarGalleryProps {
  carId: string;
  carName: string;
  maxPhotos?: number;
}

export default function CarGallery({ carId, carName, maxPhotos = 20 }: CarGalleryProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [imageError, setImageError] = useState(false);
  const [photoCount, setPhotoCount] = useState(0);

  // Generate all possible photo URLs up to maxPhotos
  const allPhotos = Array.from({ length: maxPhotos }, (_, i) => {
    const photoNum = String(i + 1).padStart(2, '0');
    return {
      src: `/car-gallery/${carId}/${photoNum}.webp`,
      alt: `${carName} - Photo ${i + 1}`,
    };
  });

  // Detect actual photo count in the background
  useEffect(() => {
    const detectPhotos = async () => {
      let count = 0;
      for (let i = 1; i <= maxPhotos; i++) {
        const photoNum = String(i).padStart(2, '0');
        const src = `/car-gallery/${carId}/${photoNum}.webp`;

        try {
          const response = await fetch(src, { method: 'HEAD' });
          if (response.ok) {
            count++;
          } else {
            // Stop at first missing photo
            break;
          }
        } catch {
          // Stop on error
          break;
        }
      }
      setPhotoCount(count);
    };

    detectPhotos();
  }, [carId, maxPhotos]);

  // Always use first photo for thumbnail immediately
  const thumbnailSrc = allPhotos[0]?.src;

  // Use photos up to the detected count, or show first 3 if still detecting
  const photos = photoCount > 0 ? allPhotos.slice(0, photoCount) : allPhotos.slice(0, 3);

  const openGallery = (index: number = 0) => {
    setCurrentIndex(index);
    setIsOpen(true);
    document.body.style.overflow = 'hidden';
  };

  const closeGallery = () => {
    setIsOpen(false);
    document.body.style.overflow = 'unset';
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev + 1) % photos.length);
  };

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev - 1 + photos.length) % photos.length);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') goToNext();
    if (e.key === 'ArrowLeft') goToPrevious();
    if (e.key === 'Escape') closeGallery();
  };

  // Don't render if thumbnail doesn't exist
  if (imageError) {
    return null;
  }

  return (
    <>
      {/* Thumbnail */}
      <div
        className="relative group cursor-pointer overflow-hidden rounded-lg border-2 border-zinc-700 hover:border-purple-500 transition-all duration-300"
        onClick={() => openGallery(0)}
      >
        <div className="relative w-full aspect-[4/3]">
          <Image
            src={thumbnailSrc}
            alt={`${carName} gallery`}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            unoptimized
            onError={() => setImageError(true)}
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300" />
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
            <div className="bg-purple-600 rounded-full p-4">
              <svg
                className="w-8 h-8 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
          </div>
        </div>
        {photos.length > 0 && (
          <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
            {photos.length} {photos.length === 1 ? 'photo' : 'photos'}
          </div>
        )}
      </div>

      {/* Fullscreen Gallery Modal */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-black"
          onKeyDown={handleKeyDown}
          tabIndex={0}
          role="dialog"
          aria-modal="true"
          aria-label="Car photo gallery"
        >
          {/* Close Button */}
          <button
            onClick={closeGallery}
            className="absolute top-4 right-4 z-50 bg-zinc-800/90 hover:bg-zinc-700 text-white rounded-full p-3 transition-colors"
            aria-label="Close gallery"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Image Counter */}
          <div className="absolute top-4 left-4 z-50 bg-zinc-800/90 text-white px-4 py-2 rounded-lg text-sm font-semibold">
            {currentIndex + 1} / {photos.length}
          </div>

          {/* Car Name */}
          <div className="absolute top-16 left-4 z-50 bg-zinc-800/90 text-white px-4 py-2 rounded-lg">
            <div className="text-sm text-zinc-400">Photo Gallery</div>
            <div className="text-lg font-bold">{carName}</div>
          </div>

          {/* Main Image */}
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="relative w-full h-full flex items-center justify-center">
              <Image
                src={photos[currentIndex].src}
                alt={photos[currentIndex].alt}
                fill
                className="object-contain"
                unoptimized
                priority
              />
            </div>
          </div>

          {/* Navigation Buttons */}
          {photos.length > 1 && (
            <>
              <button
                onClick={goToPrevious}
                className="absolute left-4 top-1/2 -translate-y-1/2 z-50 bg-zinc-800/90 hover:bg-zinc-700 text-white rounded-full p-4 transition-colors"
                aria-label="Previous photo"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              <button
                onClick={goToNext}
                className="absolute right-4 top-1/2 -translate-y-1/2 z-50 bg-zinc-800/90 hover:bg-zinc-700 text-white rounded-full p-4 transition-colors"
                aria-label="Next photo"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </>
          )}

          {/* Thumbnail Strip */}
          {photos.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50 flex gap-2 bg-zinc-800/90 p-2 rounded-lg max-w-[90vw] overflow-x-auto">
              {photos.map((photo, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentIndex(index)}
                  className={`relative flex-shrink-0 w-20 h-16 rounded overflow-hidden border-2 transition-all ${
                    index === currentIndex
                      ? 'border-purple-500 scale-110'
                      : 'border-zinc-600 hover:border-zinc-400 opacity-60 hover:opacity-100'
                  }`}
                  aria-label={`Go to photo ${index + 1}`}
                >
                  <Image
                    src={photo.src}
                    alt={photo.alt}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
