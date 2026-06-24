jest.mock('../src/config/db', () => ({
  query: jest.fn(),
  ready: Promise.resolve()
}));

jest.mock('../src/utils/pythonRunner', () => ({
  runPythonJson: jest.fn()
}));

const db = require('../src/config/db');
const { runPythonJson } = require('../src/utils/pythonRunner');
const clusteringService = require('../src/services/clusteringService');

describe('Clustering Service - Python K-Means runtime', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('runFullAnalysis gọi Python K-Means và cập nhật segment vào DB', async () => {
    db.query.mockImplementation((sql, params, callback) => {
      if (sql.includes('FROM users u')) {
        callback(null, [
          {
            customer_id: 1,
            name: 'A',
            email: 'a@example.com',
            recency: 5,
            frequency: 4,
            monetary: 1000000,
            cancel_rate: 0
          },
          {
            customer_id: 2,
            name: 'B',
            email: 'b@example.com',
            recency: 80,
            frequency: 1,
            monetary: 100000,
            cancel_rate: 50
          }
        ]);
        return;
      }

      if (sql.includes('UPDATE users')) {
        callback(null, { affectedRows: 2 });
        return;
      }

      callback(null, []);
    });

    runPythonJson.mockResolvedValue({
      total: 2,
      segments: {
        Champions: 1,
        'At Risk': 1
      },
      details: [
        {
          customer_id: 1,
          segment: 'Champions',
          cluster_id: 0,
          recency: 5,
          frequency: 4,
          monetary: 1000000,
          cancel_rate: 0
        },
        {
          customer_id: 2,
          segment: 'At Risk',
          cluster_id: 1,
          recency: 80,
          frequency: 1,
          monetary: 100000,
          cancel_rate: 50
        }
      ],
      centroids: [{ recency: -1 }, { recency: 1 }],
      iterations: 3,
      actual_k: 2,
      method: 'python_kmeans_standard_scaler'
    });

    const result = await clusteringService.runFullAnalysis();

    expect(runPythonJson).toHaveBeenCalledWith(
      expect.stringContaining('customer_analytics.py'),
      'kmeans',
      expect.objectContaining({
        k: 5,
        feature_keys: ['recency', 'frequency', 'monetary', 'cancel_rate'],
        max_iterations: 100
      })
    );
    expect(result.method).toBe('python_kmeans_standard_scaler');
    expect(result.segments).toEqual({ Champions: 1, 'At Risk': 1 });
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE users'),
      expect.arrayContaining([1, 'Champions', 2, 'At Risk', 1, 'C0', 2, 'C1', 1, 2]),
      expect.any(Function)
    );
  });
});
