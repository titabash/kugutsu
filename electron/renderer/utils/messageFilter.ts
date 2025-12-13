/**
 * Message Filter Utility
 *
 * AIノードからのメッセージをフィルタリング・フォーマットするユーティリティ
 */

/**
 * メッセージを表示すべきかどうかを判定する
 * 空文字列、空白のみ、null、undefinedの場合はfalseを返す
 *
 * @param content - メッセージ内容
 * @returns 表示すべき場合はtrue
 */
export function shouldDisplayMessage(content: string | null | undefined): boolean {
  if (content === null || content === undefined) {
    return false;
  }

  if (typeof content !== 'string') {
    return false;
  }

  return content.trim().length > 0;
}

/**
 * ノードラベルとメッセージをフォーマットする
 * 空メッセージの場合はnullを返す
 *
 * @param nodeLabel - ノードのラベル
 * @param content - メッセージ内容
 * @returns フォーマットされたメッセージ、または空の場合はnull
 */
export function formatNodeMessage(nodeLabel: string, content: string): string | null {
  if (!shouldDisplayMessage(content)) {
    return null;
  }

  const trimmedContent = content.trim();
  return `**${nodeLabel}**: ${trimmedContent}`;
}
