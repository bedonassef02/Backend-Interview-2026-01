import { ExecutionContext } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
    let guard: JwtAuthGuard;

    beforeEach(() => {
        guard = new JwtAuthGuard();
    });

    it('should be defined', () => {
        expect(guard).toBeDefined();
    });

    it('should delegate canActivate to the parent AuthGuard', () => {
        // Mock the parent canActivate to return true
        const canActivateSpy = jest
            .spyOn(Object.getPrototypeOf(JwtAuthGuard.prototype), 'canActivate')
            .mockReturnValue(true);

        const mockContext = {
            switchToHttp: jest.fn().mockReturnValue({
                getRequest: jest.fn().mockReturnValue({}),
                getResponse: jest.fn().mockReturnValue({}),
            }),
            getType: jest.fn().mockReturnValue('http'),
        } as unknown as ExecutionContext;

        const result = guard.canActivate(mockContext);

        expect(canActivateSpy).toHaveBeenCalledWith(mockContext);
        expect(result).toBe(true);

        canActivateSpy.mockRestore();
    });

    it('should return false when parent canActivate returns false', () => {
        const canActivateSpy = jest
            .spyOn(Object.getPrototypeOf(JwtAuthGuard.prototype), 'canActivate')
            .mockReturnValue(false);

        const mockContext = {} as ExecutionContext;
        const result = guard.canActivate(mockContext);

        expect(result).toBe(false);
        canActivateSpy.mockRestore();
    });
});
