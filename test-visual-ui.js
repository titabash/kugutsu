#!/usr/bin/env node

// ビジュアルUIのテスト用スクリプト
const { ParallelLogViewer } = require('./dist/utils/ParallelLogViewer');

async function testVisualUI() {
  console.log('ビジュアルUIテストを開始...');
  
  const viewer = new ParallelLogViewer();
  
  // テスト用のエンジニアを追加
  viewer.addEngineer('engineer-1', '🔧 ユーザー認証機能実装');
  viewer.addEngineer('engineer-2', '🔧 API エンドポイント作成');
  viewer.addEngineer('ProductOwner', '📋 要求分析');
  
  viewer.start();
  
  // テストログを送信
  let counter = 0;
  const logInterval = setInterval(() => {
    const engineers = ['engineer-1', 'engineer-2', 'ProductOwner'];
    const levels = ['info', 'warn', 'error', 'debug'];
    const messages = [
      'ファイルを読み込み中...',
      'コンポーネントを作成しています',
      'テストを実行中',
      '依存関係を解決中',
      'ビルドが完了しました',
      'レビューを開始します'
    ];
    
    const engineer = engineers[counter % engineers.length];
    const level = levels[Math.floor(Math.random() * levels.length)];
    const message = messages[Math.floor(Math.random() * messages.length)];
    
    viewer.log(engineer, level, `${message} (${counter + 1})`, 'Test');
    
    counter++;
    
    if (counter >= 30) {
      clearInterval(logInterval);
      console.log('\nテスト完了! qキーまたはCtrl+Cで終了してください。');
    }
  }, 500);
  
  // 10秒後に自動終了
  setTimeout(() => {
    clearInterval(logInterval);
    viewer.destroy();
    console.log('テスト終了');
    process.exit(0);
  }, 15000);
}

testVisualUI().catch(console.error);