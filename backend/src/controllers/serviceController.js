const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const serviceModel = require('../models/serviceModel');

const SERVICE_UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads', 'services');
const SERVICE_UPLOAD_URL_PREFIX = '/uploads/services/';
const IMAGE_DATA_URL_PATTERN = /^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=]+)$/;
const MIME_TO_EXTENSION = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif'
};
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

const isUploadedServiceImage = (imageUrl) =>
  typeof imageUrl === 'string' && imageUrl.startsWith(SERVICE_UPLOAD_URL_PREFIX);

const deleteUploadedServiceImage = (imageUrl) => {
  if (!isUploadedServiceImage(imageUrl)) {
    return;
  }

  const safeFileName = path.basename(imageUrl);
  const filePath = path.join(SERVICE_UPLOAD_DIR, safeFileName);

  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
};

const saveServiceImage = (imageData) => {
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

  fs.mkdirSync(SERVICE_UPLOAD_DIR, { recursive: true });

  const extension = MIME_TO_EXTENSION[mimeType] || 'png';
  const fileName = `service-${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${extension}`;
  const filePath = path.join(SERVICE_UPLOAD_DIR, fileName);

  fs.writeFileSync(filePath, buffer);

  return `${SERVICE_UPLOAD_URL_PREFIX}${fileName}`;
};

const buildServiceData = (payload, imageUrlOverride) => ({
  name: payload.name.trim(),
  description: (payload.description || '').trim(),
  price: Number(payload.price),
  duration: Number(payload.duration),
  category: (payload.category || '').trim(),
  image_url: imageUrlOverride,
  status: payload.status || 'active'
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

exports.createService = (req, res) => {
  const { name, description, price, duration, category, image_url, image_data } = req.body;

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
      uploadedImageUrl = saveServiceImage(image_data);
      storedImageUrl = uploadedImageUrl;
    }
  } catch (error) {
    return res.status(error.status || 500).json({ message: error.message });
  }

  const serviceData = buildServiceData(
    { name, description, price: parsedPrice, duration: parsedDuration, category, status: 'active' },
    storedImageUrl
  );

  serviceModel.createService(serviceData, (err, result) => {
    if (err) {
      if (uploadedImageUrl) {
        deleteUploadedServiceImage(uploadedImageUrl);
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
  const { name, description, price, duration, category, image_url, image_data, status } = req.body;

  if (!name || !price || !duration) {
    return res.status(400).json({ message: 'Vui lòng cung cấp đầy đủ thông tin' });
  }

  const parsedPrice = Number(price);
  const parsedDuration = Number(duration);

  if (!Number.isFinite(parsedPrice) || !Number.isFinite(parsedDuration) || parsedPrice < 0 || parsedDuration <= 0) {
    return res.status(400).json({ message: 'Giá và thời gian dịch vụ không hợp lệ' });
  }

  return serviceModel.getServiceById(id, (findErr, existingService) => {
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
        uploadedImageUrl = saveServiceImage(image_data);
        storedImageUrl = uploadedImageUrl;
      }
    } catch (error) {
      return res.status(error.status || 500).json({ message: error.message });
    }

    const serviceData = buildServiceData(
      { name, description, price: parsedPrice, duration: parsedDuration, category, status },
      storedImageUrl
    );

    return serviceModel.updateService(id, serviceData, (updateErr, result) => {
      if (updateErr) {
        if (uploadedImageUrl) {
          deleteUploadedServiceImage(uploadedImageUrl);
        }

        return res.status(500).json({ message: 'Lỗi server', error: updateErr });
      }

      if (!result?.affectedRows) {
        if (uploadedImageUrl) {
          deleteUploadedServiceImage(uploadedImageUrl);
        }

        return res.status(404).json({ message: 'Dịch vụ không tồn tại' });
      }

      if (uploadedImageUrl && isUploadedServiceImage(existingService.image_url)) {
        deleteUploadedServiceImage(existingService.image_url);
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

exports.deleteService = (req, res) => {
  const { id } = req.params;

  return serviceModel.getServiceById(id, (findErr, existingService) => {
    if (findErr) {
      return res.status(500).json({ message: 'Lỗi server', error: findErr });
    }

    if (!existingService) {
      return res.status(404).json({ message: 'Dịch vụ không tồn tại' });
    }

    return serviceModel.deleteService(id, (deleteErr, result) => {
      if (deleteErr) {
        return res.status(500).json({ message: 'Lỗi server', error: deleteErr });
      }

      if (!result?.affectedRows) {
        return res.status(404).json({ message: 'Dịch vụ không tồn tại' });
      }

      if (isUploadedServiceImage(existingService.image_url)) {
        deleteUploadedServiceImage(existingService.image_url);
      }

      return res.status(200).json({ success: true, message: 'Xóa dịch vụ thành công' });
    });
  });
};