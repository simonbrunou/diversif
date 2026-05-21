export type LegalIdentity = {
  controllerName: string;
  controllerEmail: string;
  controllerAddress: string;
  publicationDirector: string;
  hostProvider: string;
  hostProviderAddress: string;
  retentionInactiveDays: number;
};

const PLACEHOLDER = 'à compléter';

function read(name: string): string {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value.trim() : PLACEHOLDER;
}

export function getLegalIdentity(): LegalIdentity {
  const retentionRaw = process.env.RETENTION_INACTIVE_DAYS;
  const retentionParsed = retentionRaw ? Number.parseInt(retentionRaw, 10) : NaN;
  const retentionInactiveDays =
    Number.isFinite(retentionParsed) && retentionParsed > 0 ? retentionParsed : 1095;

  return {
    controllerName: read('LEGAL_CONTROLLER_NAME'),
    controllerEmail: read('LEGAL_CONTROLLER_EMAIL'),
    controllerAddress: read('LEGAL_CONTROLLER_ADDRESS'),
    publicationDirector: read('LEGAL_PUBLICATION_DIRECTOR'),
    hostProvider: read('LEGAL_HOST_PROVIDER'),
    hostProviderAddress: read('LEGAL_HOST_PROVIDER_ADDRESS'),
    retentionInactiveDays
  };
}
