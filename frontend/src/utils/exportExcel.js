/**
 * exportExcel.js — Excel export utility using SheetJS
 *
 * Usage:
 *   import { exportToExcel } from '../../utils/exportExcel';
 *
 *   exportToExcel({
 *     fileName: 'bao-cao-lich-hen',
 *     sheets: [
 *       {
 *         name: 'Lịch hẹn',
 *         columns: [
 *           { key: 'id', header: 'ID', width: 8 },
 *           { key: 'customer_name', header: 'Khách hàng', width: 22 },
 *           { key: 'total_amount', header: 'Tổng tiền', width: 16, transform: (v) => Number(v || 0) },
 *         ],
 *         rows: appointments
 *       }
 *     ]
 *   });
 */

import * as XLSX from 'xlsx';

/**
 * @param {Object} config
 * @param {string} config.fileName - File name without extension
 * @param {Array<{name: string, columns: Array, rows: Array}>} config.sheets
 *   columns: [{ key, header, width?, transform? }]
 *   rows: array of objects
 */
export const exportToExcel = ({ fileName = 'export', sheets = [] }) => {
  if (!sheets.length || !sheets[0].rows?.length) {
    window.alert('Không có dữ liệu để xuất.');
    return;
  }

  const wb = XLSX.utils.book_new();

  sheets.forEach((sheet) => {
    const { name = 'Sheet', columns = [], rows = [] } = sheet;

    // Build header row
    const headers = columns.map((col) => col.header || col.key);

    // Build data rows
    const data = rows.map((row) =>
      columns.map((col) => {
        let val = row[col.key];
        if (col.transform) {
          val = col.transform(val, row);
        }
        return val !== null && val !== undefined ? val : '';
      })
    );

    // Create worksheet
    const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);

    // Set column widths
    ws['!cols'] = columns.map((col) => ({ wch: col.width || 18 }));

    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31)); // Excel max 31 chars
  });

  // Generate and download
  XLSX.writeFile(wb, `${fileName}.xlsx`);
};

export default exportToExcel;
