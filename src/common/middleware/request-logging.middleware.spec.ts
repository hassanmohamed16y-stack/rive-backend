import { Logger } from '@nestjs/common';
import { EventEmitter } from 'events';
import { requestLoggingMiddleware } from './request-logging.middleware';

describe('requestLoggingMiddleware', () => {
  function createResponse() {
    const response = new EventEmitter() as EventEmitter & { statusCode: number; setHeader: jest.Mock };
    response.statusCode = 200;
    response.setHeader = jest.fn();
    return response;
  }

  it('includes the client ip in the log entry when request.ip is set', () => {
    const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const request = { method: 'GET', path: '/api/v1/products', ip: '203.0.113.7' } as any;
    const response = createResponse();

    requestLoggingMiddleware(request, response as any, jest.fn());
    response.emit('finish');

    expect(logSpy).toHaveBeenCalledTimes(1);
    const entry = JSON.parse(logSpy.mock.calls[0][0] as string);
    expect(entry.ip).toBe('203.0.113.7');

    logSpy.mockRestore();
  });

  it('omits the ip field when request.ip is undefined', () => {
    const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const request = { method: 'GET', path: '/api/v1/products' } as any;
    const response = createResponse();

    requestLoggingMiddleware(request, response as any, jest.fn());
    response.emit('finish');

    const entry = JSON.parse(logSpy.mock.calls[0][0] as string);
    expect(entry.ip).toBeUndefined();

    logSpy.mockRestore();
  });
});
