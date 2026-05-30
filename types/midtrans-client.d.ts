declare module 'midtrans-client' {
  interface SnapConfig {
    isProduction: boolean
    serverKey: string
    clientKey: string
  }

  interface TransactionDetails {
    order_id: string
    gross_amount: number
  }

  interface SnapCreateTransactionResult {
    token: string
    redirect_url: string
  }

  class Snap {
    constructor(config: SnapConfig)
    createTransaction(
      parameter: Record<string, unknown>
    ): Promise<SnapCreateTransactionResult>
    createTransactionToken(
      parameter: Record<string, unknown>
    ): Promise<string>
  }

  const MidtransClient: { Snap: typeof Snap }
  export = MidtransClient
}
