const getImageUrl = (images, imageIndex, styleIndex, defaultStyleIndex, imagesHost) => {
  // TODO: switch to using width and height fields for searching (best effort search)
  // every image is still resized in vue-storefront-api, no matter what getImageUrl returns
  const wantedImage = images[imageIndex]
  let imageUrlToUse = null
  if (wantedImage) {
    const { attributes: { styles } } = wantedImage
    if (styles[styleIndex]) {
      imageUrlToUse = styles[styleIndex].url
    } else if (typeof (defaultStyleIndex) === 'number') {
      if (styles[defaultStyleIndex]) {
        imageUrlToUse = styles[defaultStyleIndex].url
      }
    }
  }
  if (imageUrlToUse) {
    if (imagesHost) {
      return new URL(imageUrlToUse, imagesHost)
    }
    return imageUrlToUse
  }
  return null
}

// TODO: move the following somewhere else, maby esToSpree.ts
const getESMediaGallery = (images) => {
  return images.reduce(
    (acc, _, imageIndex: number) => {
      const imageUrl = getImageUrl(images, imageIndex, 3, null, null)
      if (imageUrl) {
        return [...acc, {
          image: imageUrl,
          lab: null,
          pos: imageIndex + 1,
          typ: 'image'
        }]
      }
      return acc
    },
    []
  )
}

export { getImageUrl, getESMediaGallery }
