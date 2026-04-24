const DEFAULT_BANK_BIN = '970405';
const DEFAULT_BANK_NAME = 'Agribank';
const DEFAULT_ACCOUNT_NAME = '';
const DEFAULT_TEMPLATE = 'compact2';
const DEFAULT_IMAGE_BASE_URL = 'https://img.vietqr.io/image';

const getVietQrConfig = () => {
  const bankBin = String(process.env.VIETQR_BANK_BIN || DEFAULT_BANK_BIN).trim();
  const bankName = String(process.env.VIETQR_BANK_NAME || DEFAULT_BANK_NAME).trim();
  const accountNo = String(process.env.VIETQR_ACCOUNT_NO || '').trim();
  const accountName = String(process.env.VIETQR_ACCOUNT_NAME || DEFAULT_ACCOUNT_NAME).trim();
  const template = String(process.env.VIETQR_TEMPLATE || DEFAULT_TEMPLATE)
    .trim()
    .replace(/\.(png|jpg|jpeg)$/i, '');
  const imageBaseUrl = String(process.env.VIETQR_IMAGE_BASE_URL || DEFAULT_IMAGE_BASE_URL).trim();

  if (!bankBin || !accountNo || !accountName) {
    return null;
  }

  return {
    bankBin,
    bankName,
    accountNo,
    accountName,
    template: template || DEFAULT_TEMPLATE,
    imageBaseUrl: imageBaseUrl || DEFAULT_IMAGE_BASE_URL
  };
};

const buildVietQrImageUrl = ({ bankBin, accountNo, template, imageBaseUrl, amount, addInfo, accountName }) => {
  const url = new URL(`${imageBaseUrl.replace(/\/+$/, '')}/${bankBin}-${accountNo}-${template}.png`);

  if (Number(amount) > 0) {
    url.searchParams.set('amount', String(Math.round(Number(amount))));
  }

  if (addInfo) {
    url.searchParams.set('addInfo', String(addInfo));
  }

  if (accountName) {
    url.searchParams.set('accountName', String(accountName));
  }

  return url.toString();
};

module.exports = {
  getVietQrConfig,
  buildVietQrImageUrl
};
