import { z } from 'zod'

export const esquemaLogin = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email({ message: 'Informe um email válido' })),
  senha: z.string().min(1, { message: 'Informe a senha' }),
})

export type EntradaLogin = z.infer<typeof esquemaLogin>
