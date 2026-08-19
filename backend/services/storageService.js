import ImageKit from 'imagekit';

let imagekit = null;

const getImageKitInstance = () => {
  if (!imagekit) {
    const publicKey = process.env.IMAGEKIT_PUBLIC_KEY;
    const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
    const urlEndpoint = process.env.IMAGEKIT_URL_ENDPOINT;

    if (!publicKey || !privateKey || !urlEndpoint) {
      console.warn('StorageService: ImageKit keys are missing. Resume uploads will fallback to local storage emulation.');
      return null;
    }

    imagekit = new ImageKit({
      publicKey,
      privateKey,
      urlEndpoint
    });
  }
  return imagekit;
};

export const uploadResumeToImageKit = async (fileBuffer, fileName) => {
  const ik = getImageKitInstance();
  if (!ik) {
    // If not configured, mock upload URL
    console.warn('StorageService: ImageKit not configured, returning local mock file reference.');
    return `https://ik.imagekit.io/mock/resumes/${Date.now()}_${fileName}`;
  }

  try {
    const response = await ik.upload({
      file: fileBuffer,
      fileName: fileName,
      folder: '/resumes',
      useUniqueFileName: true
    });
    console.log('StorageService: Successfully uploaded resume to ImageKit:', response.url);
    return response.url;
  } catch (error) {
    console.error('StorageService: ImageKit upload failed:', error.message);
    throw error;
  }
};
