#!/usr/bin/env python3
"""Claude Code SDKマルチプロセシングテスト"""

import multiprocessing
import queue

def run_claude_in_separate_process(prompt_text, result_queue):
    """完全に分離されたプロセスでClaude Code SDKを実行（グローバル関数）"""
    try:
        import asyncio
        from claude_code_sdk import query
        
        async def execute_query():
            messages = []
            count = 0
            
            async for message in query(prompt=prompt_text):
                count += 1
                if hasattr(message, 'content') and message.content:
                    for content_item in message.content:
                        if hasattr(content_item, 'text') and content_item.text:
                            messages.append(content_item.text)
                
                # メッセージ数制限
                if count > 5:  # さらに短縮
                    break
            
            return messages[-1] if messages else "タスクが完了しました"
        
        # 新しいプロセス内で新しいイベントループ
        result = asyncio.run(execute_query())
        result_queue.put(("success", result))
        
    except Exception as e:
        result_queue.put(("error", str(e)))

def test_claude_multiprocessing():
    """Claude Code SDKマルチプロセシングテスト"""
    print("Claude Code SDKマルチプロセシングテスト開始...")
    
    ctx = multiprocessing.get_context('spawn')
    result_queue = ctx.Queue()
    
    process = ctx.Process(
        target=run_claude_in_separate_process,
        args=("2 + 2の答えを教えて", result_queue)
    )
    
    process.start()
    
    try:
        status, result = result_queue.get(timeout=30)
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
    test_claude_multiprocessing()