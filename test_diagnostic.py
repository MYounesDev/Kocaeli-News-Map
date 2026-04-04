#!/usr/bin/env python3
"""
Quick diagnostic script to test the entire geocoding pipeline.
Run this after starting the backend to verify everything is working.
"""

import asyncio
import subprocess
import sys
import json
from pathlib import Path

# Add server to path
server_path = Path(__file__).parent / "server"
sys.path.insert(0, str(server_path))

# Test imports
try:
    from app.services.geocoder import geocode
    from app.services.location import extract_location
    from app.config import get_settings
    from app.database import connect_db, close_db, is_connected
    print("✅ Imports successful")
except ImportError as e:
    print(f"❌ Import failed: {e}")
    print("   Make sure you're running this from the root of the project")
    sys.exit(1)


async def test_geocoding():
    """Test if geocoding API works"""
    print("\n" + "="*60)
    print("TEST 1: Geocoding API")
    print("="*60)
    
    settings = get_settings()
    
    if not settings.GOOGLE_MAPS_API_KEY:
        print("❌ GOOGLE_MAPS_API_KEY not set in server/.env")
        return False
    
    print(f"✅ API Key configured (length: {len(settings.GOOGLE_MAPS_API_KEY)})")
    
    # Ensure database is connected
    if not is_connected():
        print("📡 Connecting to database...")
        try:
            await connect_db()
            print("✅ Database connected")
        except Exception as e:
            print(f"❌ Failed to connect to database: {e}")
            return False
    
    # Test geocoding
    test_locations = [
        "Gebze, Kocaeli",
        "İzmit, Kocaeli", 
        "Darıca, Kocaeli",
    ]
    
    success_count = 0
    for location in test_locations:
        try:
            result = await geocode(location)
            if result:
                print(f"✅ {location:20} → ({result['lat']:.4f}, {result['lng']:.4f})")
                success_count += 1
            else:
                print(f"❌ {location:20} → Failed to geocode")
        except Exception as e:
            print(f"❌ {location:20} → Error: {e}")
    
    print(f"\nResult: {success_count}/{len(test_locations)} locations geocoded successfully")
    return success_count == len(test_locations)


def test_location_extraction():
    """Test if location extraction works"""
    print("\n" + "="*60)
    print("TEST 2: Location Extraction")
    print("="*60)
    
    # Note: Extraction returns format "District, Kocaeli" or "Neighborhood, District, Kocaeli"
    test_texts = [
        ("Incident happened in Gebze today", "Gebze, Kocaeli"),
        ("İzmit'de yangın çıktı dün gece", "İzmit, Kocaeli"),
        ("Gebze OSB'de trafik kazası meydana geldi", "Gebze, Kocaeli"),
        ("No location in this text", None),
    ]
    
    success_count = 0
    for text, expected in test_texts:
        extracted = extract_location(text)
        if extracted == expected:
            print(f"✅ '{text[:40]}'")
            print(f"   → Extracted: {extracted}")
            success_count += 1
        else:
            print(f"❌ '{text[:40]}'")
            print(f"   → Expected: {expected}")
            print(f"   → Got:      {extracted}")
    
    print(f"\nResult: {success_count}/{len(test_texts)} extractions correct")
    return success_count == len(test_texts)


def test_env_files():
    """Check if .env files are properly configured"""
    print("\n" + "="*60)
    print("TEST 3: Environment Files")
    print("="*60)
    
    issues = []
    
    # Check server/.env
    server_env = Path("server/.env")
    if not server_env.exists():
        issues.append("❌ server/.env not found")
    else:
        content = server_env.read_text()
        if "GOOGLE_MAPS_API_KEY=" not in content:
            issues.append("❌ server/.env missing GOOGLE_MAPS_API_KEY")
        else:
            # Check if it has a value
            line = [l for l in content.split('\n') if l.startswith('GOOGLE_MAPS_API_KEY=')][0]
            if line == "GOOGLE_MAPS_API_KEY=" or line == "GOOGLE_MAPS_API_KEY=''":
                issues.append("❌ server/.env has empty GOOGLE_MAPS_API_KEY")
            else:
                print("✅ server/.env has GOOGLE_MAPS_API_KEY configured")
    
    # Check client/.env.local
    client_env = Path("client/.env.local")
    if not client_env.exists():
        issues.append("⚠️  client/.env.local not found (will use defaults)")
    else:
        content = client_env.read_text()
        if "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=" not in content:
            issues.append("❌ client/.env.local missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY")
        else:
            line = [l for l in content.split('\n') if l.startswith('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=')][0]
            if line == "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=" or line == "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=''":
                issues.append("❌ client/.env.local has empty NEXT_PUBLIC_GOOGLE_MAPS_API_KEY")
            else:
                print("✅ client/.env.local has NEXT_PUBLIC_GOOGLE_MAPS_API_KEY configured")
    
    if issues:
        for issue in issues:
            print(issue)
        print("\nFix: See ENV_SETUP_GUIDE.md for configuration instructions")
        return False
    
    return True


async def main():
    print("🔍 News2 Diagnostic Test Suite")
    print("="*60)
    
    tests = [
        ("Environment Files", test_env_files),
        ("Location Extraction", test_location_extraction),
        ("Geocoding API", test_geocoding),
    ]
    
    results = {}
    for name, test_func in tests:
        try:
            if asyncio.iscoroutinefunction(test_func):
                results[name] = await test_func()
            else:
                results[name] = test_func()
        except Exception as e:
            print(f"\n❌ Test failed with exception: {e}")
            import traceback
            traceback.print_exc()
            results[name] = False
    
    # Close database connection if opened
    if is_connected():
        await close_db()
    
    # Summary
    print("\n" + "="*60)
    print("SUMMARY")
    print("="*60)
    
    for name, passed in results.items():
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status}: {name}")
    
    all_passed = all(results.values())
    
    if all_passed:
        print("\n🎉 All tests passed! Your setup should work.")
        print("\nNext steps:")
        print("1. Start the scraper: POST /api/scrape")
        print("2. Check browser: http://localhost:3000")
        print("3. You should see the map with markers")
    else:
        print("\n⚠️  Some tests failed. Check the errors above.")
        print("\nRefer to: ENV_SETUP_GUIDE.md and DEBUGGING_GUIDE.md")
    
    return 0 if all_passed else 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
