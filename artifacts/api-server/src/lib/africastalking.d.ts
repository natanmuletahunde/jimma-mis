declare module "africastalking" {
  interface AtOptions {
    username: string;
    apiKey: string;
  }
  interface SendOptions {
    to: string[];
    message: string;
    from?: string;
  }
  interface SmsService {
    send(options: SendOptions): Promise<unknown>;
  }
  interface AtInstance {
    SMS: SmsService;
  }
  function AfricasTalking(options: AtOptions): AtInstance;
  export = AfricasTalking;
}
