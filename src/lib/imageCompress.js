// Compress an image File client-side before upload.
// Returns the original File untouched for GIFs (preserves animation) or files
// already under the size threshold; otherwise a JPEG/WebP Blob wrapped as a File.
export async function compressImage(file, opts = {}) {
  if (!file || !(file instanceof Blob)) return file
  if (file.type === 'image/gif') return file
  if (!file.type.startsWith('image/')) return file

  const {
    maxWidth = 1600,
    maxHeight = 1600,
    maxSizeKB = 300,
    quality = 0.82,
    mimeType = 'image/jpeg',
  } = opts

  if (file.size <= 200 * 1024) return file

  const bitmap = await loadBitmap(file)
  const { width, height } = scaleDown(bitmap.width, bitmap.height, maxWidth, maxHeight)

  let q = quality
  let blob = await drawToBlob(bitmap, width, height, mimeType, q)

  // Iteratively lower quality if still too big (down to 0.5)
  while (blob && blob.size > maxSizeKB * 1024 && q > 0.5) {
    q -= 0.1
    blob = await drawToBlob(bitmap, width, height, mimeType, q)
  }

  if (bitmap.close) bitmap.close()

  if (!blob || blob.size >= file.size) return file

  const ext = mimeType === 'image/webp' ? 'webp' : 'jpg'
  const baseName = (file.name || 'image').replace(/\.[^.]+$/, '')
  return new File([blob], `${baseName}.${ext}`, { type: mimeType })
}

function scaleDown(w, h, maxW, maxH) {
  if (w <= maxW && h <= maxH) return { width: w, height: h }
  const ratio = Math.min(maxW / w, maxH / h)
  return { width: Math.round(w * ratio), height: Math.round(h * ratio) }
}

async function loadBitmap(file) {
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(file) } catch { /* fallback below */ }
  }
  return await loadViaImage(file)
}

function loadViaImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e) }
    img.src = url
  })
}

function drawToBlob(source, width, height, mimeType, quality) {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    ctx.drawImage(source, 0, 0, width, height)
    canvas.toBlob((b) => resolve(b), mimeType, quality)
  })
}
