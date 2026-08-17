export function formatarData(iso: string | null | undefined): string {
  if (!iso) {
    return '-';
  }
  return new Date(iso).toLocaleString('pt-BR');
}
