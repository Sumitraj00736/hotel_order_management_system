const cloudinaryConfig = {
  cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
  apiKey: process.env.CLOUDINARY_API_KEY || '',
  apiSecret: process.env.CLOUDINARY_API_SECRET || ''
};

const hasCloudinaryConfig = Boolean(
  cloudinaryConfig.cloudName && cloudinaryConfig.apiKey && cloudinaryConfig.apiSecret
);

module.exports = {
  cloudinaryConfig,
  hasCloudinaryConfig
};
