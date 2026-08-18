import re

with open('src/App.tsx', 'r') as f:
    content = f.read()

# 1. Add imports
imports = """
import { GlobalYouTubePlayer } from './components/GlobalYouTubePlayer';
import { MiniPlayer } from './components/MiniPlayer';
"""
content = content.replace("import { RadioEngineProvider } from './contexts/RadioEngineContext';", "import { RadioEngineProvider } from './contexts/RadioEngineContext';\n" + imports)

# 2. Add inside RadioEngineProvider
provider_start = "<RadioEngineProvider requests={requests} onUpdateStatus={handleUpdateStatus} userRole={userRole}>"
content = content.replace(provider_start, provider_start + "\n      <GlobalYouTubePlayer />")

# 3. Add MiniPlayer at the end
provider_end = "    </RadioEngineProvider>"
content = content.replace(provider_end, "      <MiniPlayer activeTab={activeTab} setActiveTab={setActiveTab} />\n" + provider_end)

with open('src/App.tsx', 'w') as f:
    f.write(content)

print("Patched App.tsx")
