cask "claude-avatars" do
  version "1.0.0"
  sha256 "bb5c701519cefc31a2dd1eb9873153e3b11cd2a9070001dca2b71e168662d573"

  url "https://github.com/kumarvnsh/Claude-Avatar/releases/download/v#{version}/Claude-Avatars-latest-arm64.dmg"
  name "Claude Avatars"
  desc "Animated pixel-art companions for active Claude Code sessions"
  homepage "https://github.com/kumarvnsh/Claude-Avatar"
  depends_on arch: :arm64

  app "Claude Avatars.app"
end
