const request = require('supertest');
const app = require('./server'); // We need to export 'app' from server.js
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Mock the Google Generative AI library
jest.mock('@google/generative-ai', () => {
  // Mock the parts we use in server.js
  const mockGenerateContent = jest.fn();
  const mockGetGenerativeModel = jest.fn(() => ({
    generateContent: mockGenerateContent,
  }));
  const mockGoogleGenerativeAI = jest.fn(() => ({
    getGenerativeModel: mockGetGenerativeModel,
  }));

  // We need to 'spy' on these mocks to reset them
  return {
    GoogleGenerativeAI: mockGoogleGenerativeAI,
    _mockGenerateContent: mockGenerateContent, // Expose for testing
  };
});

// Get the mock function to control it in our tests
const { _mockGenerateContent } = require('@google/generative-ai');

// --- The Tests ---
describe('Magic Calculator API', () => {

  // Reset mocks before each test
  beforeEach(() => {
    _mockGenerateContent.mockClear();
  });

  // Test 1: The Health Check
  it('should confirm the server is running on GET /', async () => {
    const res = await request(app).get('/');
    expect(res.statusCode).toBe(200);
    expect(res.text).toBe('AI Solver Server is running!');
  });

  // Test 2: Missing Image Error
  it('should return 400 if no image is provided to /solve', async () => {
    const res = await request(app)
      .post('/solve')
      .send({}); // Send an empty body

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('Image data is required.');
  });

  // Test 3: Successful Solution
  it('should return 200 and a solution on POST /solve', async () => {
    // Set up the mock AI response
    const mockSolution = '42';
    _mockGenerateContent.mockResolvedValue({
      response: {
        text: () => mockSolution,
      },
    });

    const mockImageData = 'data:image/png;base64,iVBORw0KGgo...'; // Fake image data

    const res = await request(app)
      .post('/solve')
      .send({ image: mockImageData });

    expect(res.statusCode).toBe(200);
    expect(res.body.solution).toBe(mockSolution);
  });

  // Test 4: AI Failure
  it('should return 500 if the AI model fails', async () => {
    // Set up the mock AI to throw an error
    _mockGenerateContent.mockRejectedValue(new Error('AI failed'));

    const mockImageData = 'data:image/png;base64,iVBORw0KGgo...';

    const res = await request(app)
      .post('/solve')
      .send({ image: mockImageData });

    expect(res.statusCode).toBe(500);
    expect(res.body.error).toContain('AI failed');
  });

});