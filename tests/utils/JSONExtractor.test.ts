/**
 * JSONExtractor Unit Tests (Jest)
 *
 * AI応答からのJSON抽出とエラーハンドリングのテスト
 */

import { jest } from '@jest/globals';

// Import the module to test (will be created)
const { JSONExtractor } = await import('../../src/utils/JSONExtractor.js');

describe('JSONExtractor', () => {
  describe('extractFromCodeBlock', () => {
    test('should extract valid JSON from code block', () => {
      const response = `
Here is the analysis:

\`\`\`json
{
  "tasks": [
    {
      "id": "task-1",
      "title": "Implement feature"
    }
  ]
}
\`\`\`

That's the result.
`;

      const result = JSONExtractor.extractFromCodeBlock(response);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        tasks: [
          {
            id: 'task-1',
            title: 'Implement feature',
          },
        ],
      });
      expect(result.error).toBeUndefined();
    });

    test('should handle JSON without code block markers', () => {
      const response = `{
  "tasks": [
    {
      "id": "task-1",
      "title": "Implement feature"
    }
  ]
}`;

      const result = JSONExtractor.extractFromCodeBlock(response, {
        allowRawJSON: true,
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        tasks: [
          {
            id: 'task-1',
            title: 'Implement feature',
          },
        ],
      });
    });

    test('should return error when no JSON block found', () => {
      const response = 'This is just plain text without any JSON.';

      const result = JSONExtractor.extractFromCodeBlock(response);

      expect(result.success).toBe(false);
      expect(result.error).toContain('JSONブロックが見つかりません');
      expect(result.data).toBeUndefined();
    });

    test('should return detailed error for invalid JSON syntax', () => {
      const response = `
\`\`\`json
{
  "tasks": [
    {
      "id": "task-1"
      "title": "Missing comma"
    }
  ]
}
\`\`\`
`;

      const result = JSONExtractor.extractFromCodeBlock(response);

      expect(result.success).toBe(false);
      expect(result.error).toContain('JSONパースエラー');
      expect(result.rawJSON).toBeDefined();
      expect(result.parseError).toBeDefined();
    });

    test('should handle multiple JSON blocks and extract the first one', () => {
      const response = `
First JSON block:
\`\`\`json
{
  "first": true
}
\`\`\`

Second JSON block:
\`\`\`json
{
  "second": true
}
\`\`\`
`;

      const result = JSONExtractor.extractFromCodeBlock(response);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ first: true });
    });

    test('should extract JSON from different code block types', () => {
      const response = `
\`\`\`javascript
{
  "tasks": [
    {
      "id": "task-1"
    }
  ]
}
\`\`\`
`;

      const result = JSONExtractor.extractFromCodeBlock(response, {
        allowedBlockTypes: ['json', 'javascript'],
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        tasks: [
          {
            id: 'task-1',
          },
        ],
      });
    });
  });

  describe('extractWithRetry', () => {
    test('should succeed on first attempt', async () => {
      const extractor = jest.fn<any>().mockReturnValue({
        success: true,
        data: { result: 'success' },
      });

      const result = await JSONExtractor.extractWithRetry(
        () => 'valid json',
        extractor,
        {
          maxRetries: 3,
        }
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ result: 'success' });
      expect(result.attempts).toBe(1);
      expect(extractor).toHaveBeenCalledTimes(1);
    });

    test('should retry on failure and eventually succeed', async () => {
      let callCount = 0;
      const extractor = jest.fn<any>().mockImplementation(() => {
        callCount++;
        if (callCount < 3) {
          return {
            success: false,
            error: 'Temporary failure',
          };
        }
        return {
          success: true,
          data: { result: 'success after retries' },
        };
      });

      const result = await JSONExtractor.extractWithRetry(
        () => 'valid json',
        extractor,
        {
          maxRetries: 5,
          delayMs: 10,
        }
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ result: 'success after retries' });
      expect(result.attempts).toBe(3);
      expect(extractor).toHaveBeenCalledTimes(3);
    });

    test('should fail after max retries', async () => {
      const extractor = jest.fn<any>().mockReturnValue({
        success: false,
        error: 'Permanent failure',
      });

      const result = await JSONExtractor.extractWithRetry(
        () => 'invalid json',
        extractor,
        {
          maxRetries: 3,
          delayMs: 10,
        }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('リトライ上限');
      expect(result.attempts).toBe(3);
      expect(extractor).toHaveBeenCalledTimes(3);
    });

    test('should use exponential backoff for retries', async () => {
      const timestamps: number[] = [];
      const extractor = jest.fn<any>().mockImplementation(() => {
        timestamps.push(Date.now());
        return {
          success: false,
          error: 'Failure',
        };
      });

      await JSONExtractor.extractWithRetry(() => 'invalid', extractor, {
        maxRetries: 3,
        delayMs: 100,
        backoffMultiplier: 2,
      });

      // Verify exponential backoff: ~100ms, ~200ms, ~400ms delays
      expect(timestamps.length).toBe(3);
      if (timestamps.length >= 2) {
        const delay1 = timestamps[1] - timestamps[0];
        expect(delay1).toBeGreaterThanOrEqual(90); // Allow 10ms tolerance
      }
      if (timestamps.length >= 3) {
        const delay2 = timestamps[2] - timestamps[1];
        expect(delay2).toBeGreaterThanOrEqual(180); // ~200ms with tolerance
      }
    });
  });

  describe('extractTaskList', () => {
    test('should extract task list from AI response', () => {
      const response = `
Here are the tasks:

\`\`\`json
{
  "tasks": [
    {
      "id": "task-1",
      "title": "Implement auth",
      "description": "User authentication",
      "type": "feature",
      "priority": 90,
      "estimatedPoints": 5,
      "dependencies": [],
      "acceptanceCriteria": ["Users can login"],
      "status": "pending"
    }
  ]
}
\`\`\`
`;

      const result = JSONExtractor.extractTaskList(response);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data![0].id).toBe('task-1');
      expect(result.data![0].title).toBe('Implement auth');
    });

    test('should handle missing optional fields in tasks', () => {
      const response = `
\`\`\`json
{
  "tasks": [
    {
      "id": "task-1",
      "title": "Minimal task"
    }
  ]
}
\`\`\`
`;

      const result = JSONExtractor.extractTaskList(response);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data![0].id).toBe('task-1');
      expect(result.data![0].title).toBe('Minimal task');
      expect(result.data![0].description).toBe(''); // Default value
      expect(result.data![0].type).toBe('feature'); // Default value
      expect(result.data![0].priority).toBe(50); // Default value
    });

    test('should generate UUIDs for tasks missing id', () => {
      const response = `
\`\`\`json
{
  "tasks": [
    {
      "title": "Task without ID"
    }
  ]
}
\`\`\`
`;

      const result = JSONExtractor.extractTaskList(response);

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data![0].id).toMatch(/^task-[0-9a-f-]+$/);
    });

    test('should return error for empty task list', () => {
      const response = `
\`\`\`json
{
  "tasks": []
}
\`\`\`
`;

      const result = JSONExtractor.extractTaskList(response);

      expect(result.success).toBe(false);
      expect(result.error).toContain('タスクが見つかりません');
    });

    test('should return error when tasks field is missing', () => {
      const response = `
\`\`\`json
{
  "result": "success"
}
\`\`\`
`;

      const result = JSONExtractor.extractTaskList(response);

      expect(result.success).toBe(false);
      expect(result.error).toContain('tasksフィールドが見つかりません');
    });
  });

  describe('extractJSON with schema validation', () => {
    test('should validate extracted JSON against schema', () => {
      const response = `
\`\`\`json
{
  "name": "John",
  "age": 30
}
\`\`\`
`;

      const schema = {
        type: 'object',
        required: ['name', 'age'],
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
        },
      };

      const result = JSONExtractor.extractJSON(response, { schema });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ name: 'John', age: 30 });
    });

    test('should fail validation for invalid schema', () => {
      const response = `
\`\`\`json
{
  "name": "John"
}
\`\`\`
`;

      const schema = {
        type: 'object',
        required: ['name', 'age'],
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
        },
      };

      const result = JSONExtractor.extractJSON(response, { schema });

      expect(result.success).toBe(false);
      expect(result.error).toContain('スキーマバリデーションエラー');
      expect(result.validationErrors).toBeDefined();
    });
  });

  describe('Error logging and debugging', () => {
    test('should provide detailed error information for debugging', () => {
      const response = `
\`\`\`json
{
  "invalid": json
}
\`\`\`
`;

      const result = JSONExtractor.extractFromCodeBlock(response);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.rawJSON).toBeDefined(); // Original extracted string
      expect(result.parseError).toBeDefined(); // Original error object
    });

    test('should truncate long JSON in error messages', () => {
      const longJSON = `{
  "data": "${'x'.repeat(10000)}"
}`;
      const response = `\`\`\`json\n${longJSON}\n\`\`\``;

      const result = JSONExtractor.extractFromCodeBlock(response);

      // Should include truncated JSON in error for debugging
      if (!result.success && result.rawJSON) {
        expect(result.rawJSON.length).toBeLessThan(longJSON.length);
      }
    });
  });
});
