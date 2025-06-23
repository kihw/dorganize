/**
 * Dock testing utilities for different configurations
 */
class DockTester {
    static async testPerformance() {
        const start = performance.now();

        // Test with many windows
        const testWindows = Array.from({ length: 20 }, (_, i) => ({
            id: `test-${i}`,
            character: `Character${i}`,
            dofusClass: 'feca',
            enabled: true,
            initiative: Math.floor(Math.random() * 1000),
            isActive: false,
            avatar: '1'
        }));

        window.dockRenderer.windows = testWindows;
        window.dockRenderer.renderDock();

        const end = performance.now();
        console.log(`Dock render time with ${testWindows.length} windows: ${end - start}ms`);
    }

    static testResponsiveness() {
        // Test different screen sizes
        const testSizes = [
            { width: 1920, height: 1080 },
            { width: 1366, height: 768 },
            { width: 1024, height: 600 }
        ];

        testSizes.forEach(size => {
            window.resizeTo(size.width, size.height);
            window.dockRenderer.repositionIfNeeded();
            console.log(`Tested dock at ${size.width}x${size.height}`);
        });
    }
}

// Export for console testing
window.DockTester = DockTester;