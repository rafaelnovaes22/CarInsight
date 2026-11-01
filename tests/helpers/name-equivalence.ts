import { extractName } from '../../src/graph/langgraph/extractors/name-extractor';

/**
 * Diz se dois nomes colapsam no mesmo nome depois da normalizacao do
 * extractName.
 *
 * Property test que compara as strings cruas gera falso positivo: o
 * TRANSCRIPTION_FIXES mapeia nomes distintos para o mesmo destino
 * ("Michael" -> "Miguel"), e nesse caso o detector, por design, nao trata a
 * mensagem como correcao de nome. Como o fast-check sorteia seed nova a cada
 * execucao, o par so aparece de vez em quando e o CI quebra sem mudanca de
 * codigo.
 */
export function areEquivalentNames(left: string, right: string): boolean {
  const normalizedLeft = extractName(left) ?? left;
  const normalizedRight = extractName(right) ?? right;
  return normalizedLeft.toLowerCase() === normalizedRight.toLowerCase();
}
