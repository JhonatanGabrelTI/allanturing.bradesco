import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
    
    // Seed inicial se não existir config
    const count = await this.configuracaoCobranca.count();
    if (count === 0) {
      await this.configuracaoCobranca.create({
        data: {
          descricao: "Configuração Demo",
          cnpjRaiz: "123456789",
          filial: "0001",
          controle: "95",
        }
      });
      console.log('✅ Configuração inicial criada');
    }
  }
}
