const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const serviceModel = require('../../models/serviceModel');
const serviceRecommendationService = require('../../services/serviceRecommendationService');
const fsPromises = fs.promises;

const SERVICE_UPLOAD_DIR = path.join(__dirname, '..', '..', '..', 'uploads', 'services');
const SERVICE_UPLOAD_URL_PREFIX = '/uploads/services/';
const IMAGE_DATA_URL_PATTERN = /^data:(image\/(?:png|jpeg|jpg|webp|gif|jfif));base64,([A-Za-z0-9+/=]+)$/;
const MIME_TO_EXTENSION = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/jfif': 'jpg'
};
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

const isUploadedServiceImage = (imageUrl) =>
  typeof imageUrl === 'string' && imageUrl.startsWith(SERVICE_UPLOAD_URL_PREFIX);

const deleteUploadedServiceImage = async (imageUrl) => {
  if (!isUploadedServiceImage(imageUrl)) {
    return;
  }

  const safeFileName = path.basename(imageUrl);
  const filePath = path.join(SERVICE_UPLOAD_DIR, safeFileName);

  try {
    await fsPromises.unlink(filePath);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
};

const saveServiceImage = async (imageData) => {
  if (typeof imageData !== 'string' || imageData.trim() === '') {
    return '';
  }

  const match = imageData.trim().match(IMAGE_DATA_URL_PATTERN);
  if (!match) {
    const error = new Error('Ảnh dịch vụ không hợp lệ. Vui lòng chọn JPG, PNG, GIF hoặc WEBP.');
    error.status = 400;
    throw error;
  }

  const mimeType = match[1];
  const base64Payload = match[2];
  const buffer = Buffer.from(base64Payload, 'base64');

  if (!buffer.length) {
    const error = new Error('Không thể đọc dữ liệu ảnh dịch vụ.');
    error.status = 400;
    throw error;
  }

  if (buffer.length > MAX_IMAGE_SIZE_BYTES) {
    const error = new Error('Ảnh dịch vụ phải nhỏ hơn 5MB.');
    error.status = 400;
    throw error;
  }

  await fsPromises.mkdir(SERVICE_UPLOAD_DIR, { recursive: true });

  const extension = MIME_TO_EXTENSION[mimeType] || 'png';
  const fileName = `service-${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${extension}`;
  const filePath = path.join(SERVICE_UPLOAD_DIR, fileName);

  await fsPromises.writeFile(filePath, buffer);

  return `${SERVICE_UPLOAD_URL_PREFIX}${fileName}`;
};

const generateServiceCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `SVC-${result}`;
};

const buildServiceData = (payload, imageUrlOverride) => ({
  name: payload.name.trim(),
  description: (payload.description || '').trim(),
  price: Number(payload.price),
  duration: Number(payload.duration),
  category: (payload.category || '').trim(),
  image_url: imageUrlOverride,
  status: payload.status || 'active',
  service_code: payload.service_code ? payload.service_code.trim() : null
});

exports.getAllServices = (req, res) => {
  serviceModel.getAllServices((err, services) => {
    if (err) {
      return res.status(500).json({ message: 'Lỗi server', error: err });
    }

    return res.status(200).json({ success: true, data: services });
  });
};

exports.getAllServicesForAdmin = (req, res) => {
  serviceModel.getAllServices(
    (err, services) => {
      if (err) {
        return res.status(500).json({ message: 'Lỗi server', error: err });
      }

      return res.status(200).json({ success: true, data: services });
    },
    true
  );
};

exports.getServiceById = (req, res) => {
  const { id } = req.params;

  serviceModel.getServiceById(id, (err, service) => {
    if (err) {
      return res.status(500).json({ message: 'Lỗi server', error: err });
    }

    if (!service) {
      return res.status(404).json({ message: 'Dịch vụ không tồn tại' });
    }

    return res.status(200).json({ success: true, data: service });
  });
};

exports.createService = async (req, res) => {
  const { name, description, price, duration, category, image_url, image_data, service_code } = req.body;

  if (!name || !price || !duration) {
    return res.status(400).json({ message: 'Vui lòng cung cấp đầy đủ thông tin' });
  }

  const parsedPrice = Number(price);
  const parsedDuration = Number(duration);

  if (!Number.isFinite(parsedPrice) || !Number.isFinite(parsedDuration) || parsedPrice < 0 || parsedDuration <= 0) {
    return res.status(400).json({ message: 'Giá và thời gian dịch vụ không hợp lệ' });
  }

  let storedImageUrl = typeof image_url === 'string' ? image_url.trim() : '';
  let uploadedImageUrl = '';

  try {
    if (typeof image_data === 'string' && image_data.trim() !== '') {
      uploadedImageUrl = await saveServiceImage(image_data);
      storedImageUrl = uploadedImageUrl;
    }
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.message });
  }

  const hasCustomCode = typeof service_code === 'string' && service_code.trim() !== '';
  const finalServiceCode = hasCustomCode ? service_code.trim() : generateServiceCode();

  const serviceData = buildServiceData(
    { name, description, price: parsedPrice, duration: parsedDuration, category, status: 'active', service_code: finalServiceCode },
    storedImageUrl
  );

  serviceModel.createService(serviceData, async (err, result) => {
    if (err) {
      if (uploadedImageUrl) {
        try {
          await deleteUploadedServiceImage(uploadedImageUrl);
        } catch (cleanupError) {
          console.error('[SERVICE_IMAGE_CLEANUP_CREATE_ERROR]', cleanupError);
        }
      }

      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ message: 'Mã dịch vụ đã tồn tại. Vui lòng nhập mã khác.' });
      }

      return res.status(500).json({ message: 'Lỗi server', error: err });
    }

    return res.status(201).json({
      success: true,
      message: 'Tạo dịch vụ thành công',
      serviceId: result.insertId
    });
  });
};

exports.updateService = (req, res) => {
  const { id } = req.params;
  const { name, description, price, duration, category, image_url, image_data, status, service_code } = req.body;

  if (!name || !price || !duration) {
    return res.status(400).json({ message: 'Vui lòng cung cấp đầy đủ thông tin' });
  }

  const parsedPrice = Number(price);
  const parsedDuration = Number(duration);

  if (!Number.isFinite(parsedPrice) || !Number.isFinite(parsedDuration) || parsedPrice < 0 || parsedDuration <= 0) {
    return res.status(400).json({ message: 'Giá và thời gian dịch vụ không hợp lệ' });
  }

  return serviceModel.getServiceById(id, async (findErr, existingService) => {
    if (findErr) {
      return res.status(500).json({ message: 'Lỗi server', error: findErr });
    }

    if (!existingService) {
      return res.status(404).json({ message: 'Dịch vụ không tồn tại' });
    }

    let storedImageUrl = typeof image_url === 'string' ? image_url.trim() : existingService.image_url || '';
    let uploadedImageUrl = '';

    try {
      if (typeof image_data === 'string' && image_data.trim() !== '') {
        uploadedImageUrl = await saveServiceImage(image_data);
        storedImageUrl = uploadedImageUrl;
      }
    } catch (error) {
      return res.status(error.status || 500).json({ message: error.message });
    }

    let finalServiceCode = existingService.service_code;
    if (typeof service_code === 'string' && service_code.trim() !== '') {
      finalServiceCode = service_code.trim();
    } else if (!finalServiceCode) {
      finalServiceCode = generateServiceCode();
    }

    const serviceData = buildServiceData(
      { name, description, price: parsedPrice, duration: parsedDuration, category, status, service_code: finalServiceCode },
      storedImageUrl
    );

    return serviceModel.updateService(id, serviceData, async (updateErr, result) => {
      if (updateErr) {
        if (uploadedImageUrl) {
          try {
            await deleteUploadedServiceImage(uploadedImageUrl);
          } catch (cleanupError) {
            console.error('[SERVICE_IMAGE_CLEANUP_UPDATE_ERROR]', cleanupError);
          }
        }

        if (updateErr.code === 'ER_DUP_ENTRY') {
          return res.status(400).json({ message: 'Mã dịch vụ đã tồn tại. Vui lòng nhập mã khác.' });
        }

        return res.status(500).json({ message: 'Lỗi server', error: updateErr });
      }

      if (!result?.affectedRows) {
        if (uploadedImageUrl) {
          try {
            await deleteUploadedServiceImage(uploadedImageUrl);
          } catch (cleanupError) {
            console.error('[SERVICE_IMAGE_CLEANUP_NOT_FOUND_ERROR]', cleanupError);
          }
        }

        return res.status(404).json({ message: 'Dịch vụ không tồn tại' });
      }

      if (uploadedImageUrl && isUploadedServiceImage(existingService.image_url)) {
        try {
          await deleteUploadedServiceImage(existingService.image_url);
        } catch (cleanupError) {
          console.error('[SERVICE_IMAGE_CLEANUP_OLD_IMAGE_ERROR]', cleanupError);
        }
      }

      return res.status(200).json({ success: true, message: 'Cập nhật dịch vụ thành công' });
    });
  });
};

exports.updateServicePrice = (req, res) => {
  const { id } = req.params;
  const { price } = req.body;
  const parsedPrice = Number(price);

  if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
    return res.status(400).json({ message: 'Giá dịch vụ không hợp lệ' });
  }

  return serviceModel.updateServicePrice(id, parsedPrice, (err, result) => {
    if (err) {
      return res.status(500).json({ message: 'Lỗi server', error: err });
    }

    if (!result.affectedRows) {
      return res.status(404).json({ message: 'Dịch vụ không tồn tại' });
    }

    return res.status(200).json({ success: true, message: 'Cập nhật giá dịch vụ thành công' });
  });
};

exports.createCategory = (req, res) => {
  console.log('Creating category - Request body:', req.body);
  
  const { category_name } = req.body;

  if (!category_name || category_name.trim() === '') {
    console.log('Validation failed: empty category name');
    return res.status(400).json({ 
      success: false, 
      message: 'Vui lòng nhập tên danh mục.' 
    });
  }

  const categoryData = {
    category_name: category_name.trim()
  };

  console.log('Creating category with data:', categoryData);

  serviceModel.createCategory(categoryData, (err, result) => {
    if (err) {
      console.error('Database error creating category:', err);
      return res.status(500).json({ 
        success: false, 
        message: 'Lỗi server', 
        error: err 
      });
    }

    console.log('Category created successfully:', result);
    return res.status(201).json({ 
      success: true, 
      message: 'Tạo danh mục thành công.',
      data: {
        id: result.insertId,
        category_name: categoryData.category_name
      }
    });
  });
};

exports.getAllCategories = (req, res) => {
  serviceModel.getAllCategories((err, categories) => {
    if (err) {
      return res.status(500).json({ 
        success: false, 
        message: 'Lỗi server', 
        error: err 
      });
    }

    return res.status(200).json({ 
      success: true, 
      data: categories 
    });
  });
};

exports.deleteService = (req, res) => {
  const { id } = req.params;

  return serviceModel.getServiceById(id, async (findErr, existingService) => {
    if (findErr) {
      return res.status(500).json({ message: 'Lỗi server', error: findErr });
    }

    if (!existingService) {
      return res.status(404).json({ message: 'Dịch vụ không tồn tại' });
    }

    return serviceModel.deleteService(id, async (deleteErr, result) => {
      if (deleteErr) {
        return res.status(500).json({ message: 'Lỗi server', error: deleteErr });
      }

      if (!result?.affectedRows) {
        return res.status(404).json({ message: 'Dịch vụ không tồn tại' });
      }

      if (isUploadedServiceImage(existingService.image_url)) {
        try {
          await deleteUploadedServiceImage(existingService.image_url);
        } catch (cleanupError) {
          console.error('[SERVICE_IMAGE_CLEANUP_DELETE_ERROR]', cleanupError);
        }
      }

      return res.status(200).json({ success: true, message: 'Xóa dịch vụ thành công' });
    });
  });
};

exports.getServiceRecommendations = async (req, res) => {
  try {
    const result = await serviceRecommendationService.getRecommendationsForService({
      serviceId: req.query.serviceId || req.query.service_id,
      limit: req.query.limit
    });

    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Không thể lấy gợi ý dịch vụ'
    });
  }
};

exports.getTrendingServices = (req, res) => {
  serviceModel.getTrendingServices((err, services) => {
    if (err) {
      return res.status(500).json({ message: 'Lỗi server', error: err });
    }

    const bookedServices = (services || []).filter((service) => Number(service.booking_count || 0) > 0);

    // Group services by category
    const categoryMap = {};
    bookedServices.forEach((service) => {
      const category = service.category || 'Khác';
      if (!categoryMap[category]) {
        categoryMap[category] = {
          category,
          total_bookings: 0,
          services: []
        };
      }
      categoryMap[category].services.push(service);
      categoryMap[category].total_bookings += Number(service.booking_count || 0);
    });

    // Sort categories by total bookings (most popular first)
    const categories = Object.values(categoryMap)
      .sort((a, b) => b.total_bookings - a.total_bookings);

    return res.status(200).json({
      success: true,
      data: {
        categories,
        all_services: bookedServices
      }
    });
  });
};
