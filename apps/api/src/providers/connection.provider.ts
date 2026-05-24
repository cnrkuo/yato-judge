import { Inject, type Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';

export const CONNECTION_PROVIDER_TOKEN = Symbol('CONNECTION_PROVIDER_TOKEN');

export const ConnectionProvider: Provider = {
  provide: CONNECTION_PROVIDER_TOKEN,
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => new Pool({ connectionString: configService.get('DATABASE_URL')! }),
};

export const InjectConnection = () => Inject(CONNECTION_PROVIDER_TOKEN);
export const injectConnectionToken = () => CONNECTION_PROVIDER_TOKEN;
