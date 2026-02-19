import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class BradescoMockInterceptor implements NestInterceptor {
    private readonly isMock = process.env.MOCK_BRADESCO === 'true';

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        if (!this.isMock) return next.handle();

        const request = context.switchToHttp().getRequest();
        const url = request.url as string;

        // Intercepta chamadas para API Bradesco
        if (url.includes('/cobranca-registro')) {
            return of(this.mockRegistro(request.body));
        }

        if (url.includes('/cobranca-consulta')) {
            return of(this.mockConsulta(request.body));
        }

        if (url.includes('/cobranca-baixa')) {
            return of(this.mockBaixa());
        }

        return next.handle();
    }

    private mockRegistro(payload: any) {
        const nossoNumero = Math.floor(10000000000 + Math.random() * 90000000000).toString();

        // Gera linha digitável fake (47 posições)
        const linha = `23791.23456 78901.234567 89012.345678 1 123400000${payload.vlNominalTitulo.replace('.', '').padStart(10, '0')}`;

        return {
            data: {
                nuTituloGerado: parseInt(nossoNumero),
                linhaDigitavel: linha,
                cdBarras: "23791234000000123408560912345678901234567890",
                codStatus10: 1,
                status10: "A VENCER/VENCIDO",
                nomePagador: payload.nomePagador,
                vlTitulo: parseInt(payload.vlNominalTitulo.replace('.', '')),
                dtVencimento: payload.dtVencimentoTitulo,
            }
        };
    }

    private mockConsulta(payload: any) {
        return {
            data: {
                codStatus: 1,
                status: "A VENCER/VENCIDO",
                nossoNumero: payload.nossoNumero,
                dataPagamento: null,
                valorPagamento: 0,
            }
        };
    }

    private mockBaixa() {
        return {
            data: {
                status: 200,
                mensagem: "CBTT0532 - SOLICITACAO DE BAIXA EFETUADA",
            }
        };
    }
}
