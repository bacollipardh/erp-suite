import { Body, Controller, Get, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { Public } from './decorators/public.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser, JwtPayload } from './decorators/current-user.decorator';
import { buildAuthCookieOptions } from '../common/config/env';
import { AUTH_COOKIE_NAME } from './permissions';
import { AuthThrottleService } from './auth-throttle.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly authThrottle: AuthThrottleService,
  ) {}

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Login with email and password' })
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const key = `${request.ip ?? 'unknown'}:${dto.email.toLowerCase()}`;
    this.authThrottle.assertAllowed(key);

    try {
      const result = await this.authService.login(dto);
      this.authThrottle.clear(key);
      response.cookie(AUTH_COOKIE_NAME, result.accessToken, buildAuthCookieOptions());
      return result;
    } catch (error) {
      this.authThrottle.registerFailure(key);
      throw error;
    }
  }

  @Public()
  @Post('logout')
  @ApiOperation({ summary: 'Clear the current session cookie' })
  logout(@Res({ passthrough: true }) response: Response) {
    response.clearCookie(AUTH_COOKIE_NAME, {
      ...buildAuthCookieOptions(),
      maxAge: undefined,
    });
    return { success: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated user' })
  me(@CurrentUser() user: JwtPayload) {
    return this.authService.me(user.sub);
  }
}
