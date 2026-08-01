import SwiftUI

/// Pin Drop brand typography. Wraps SwiftUI Font around the custom
/// Brice (display) and Mundial (body) font families bundled via
/// UIAppFonts in Info.plist. Brice is used for big bold headers and
/// chunky button text; Mundial is the workhorse body face.
enum PinDropFont {
    case briceBlack(_ size: CGFloat)
    case briceBold(_ size: CGFloat)
    case mundialBold(_ size: CGFloat)
    case mundialDemibold(_ size: CGFloat)
    case mundialRegular(_ size: CGFloat)

    var font: Font {
        switch self {
        case .briceBlack(let s):     return .custom("Brice-Black", size: s)
        case .briceBold(let s):      return .custom("Brice-Bold", size: s)
        case .mundialBold(let s):    return .custom("Mundial-Bold", size: s)
        case .mundialDemibold(let s): return .custom("Mundial-Demibold", size: s)
        case .mundialRegular(let s):  return .custom("Mundial-Regular", size: s)
        }
    }
}

extension Text {
    /// Shortcut: `Text("PIN DROP").brand(.briceBlack(56))`
    func brand(_ font: PinDropFont) -> Text {
        self.font(font.font)
    }
}

extension View {
    func brandFont(_ font: PinDropFont) -> some View {
        self.font(font.font)
    }
}
