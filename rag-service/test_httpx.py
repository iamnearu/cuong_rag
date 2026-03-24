import asyncio
import httpx

async def run():
    async with httpx.AsyncClient() as client:
        try:
            r = await client.get("http://host.docker.internal:11434/api/tags", timeout=5)
            print("Status:", r.status_code)
            print("Text:", r.text[:100])
        except Exception as e:
            print("Error:", e)

if __name__ == "__main__":
    asyncio.run(run())
