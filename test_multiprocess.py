#!/usr/bin/env python3
"""マルチプロセシングアプローチのテスト"""

import multiprocessing
import queue

def run_claude_in_separate_process(prompt_text, result_queue):
    """完全に分離されたプロセスでClaude Code SDKを実行（グローバル関数）"""
    try:
        import asyncio
        
        # Claude Code SDKは使わずにシンプルなテスト
        async def simple_test():
            return f"プロセス分離成功: {prompt_text}"
        
        # 新しいプロセス内で新しいイベントループ
        result = asyncio.run(simple_test())
        result_queue.put(("success", result))
        
    except Exception as e:
        result_queue.put(("error", str(e)))

def test_multiprocessing():
    """マルチプロセシングテスト"""
    print("マルチプロセシングテスト開始...")
    
    ctx = multiprocessing.get_context('spawn')
    result_queue = ctx.Queue()
    
    process = ctx.Process(
        target=run_claude_in_separate_process,
        args=("テストプロンプト", result_queue)
    )
    
    process.start()
    
    try:
        status, result = result_queue.get(timeout=10)
        process.join()
        
        if status == "success":
            print(f"✅ 成功: {result}")
        else:
            print(f"❌ 失敗: {result}")
            
    except queue.Empty:
        process.terminate()
        process.join()
        print("❌ タイムアウト")

if __name__ == "__main__":
    test_multiprocessing()