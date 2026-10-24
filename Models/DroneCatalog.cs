namespace Skycraft.Models;

/// <summary>
/// Описание одной детали. Значения модификаторов применяются к базовым
/// характеристикам дрона. Количество моторов и винтов в сборке — по четыре.
/// Вес и цена указаны за штуку, а Speed/FlightTime/Range модификаторы —
/// за выбранный КОМПЛЕКТ. RangeModifier — наследуемые игровые очки
/// энергоэффективности, а не метры (пересчитываются в drone-stats.js).
/// </summary>
public sealed record DronePart(
    string Id,
    string Category,
    string Name,
    string Description,
    string Icon,
    decimal WeightKg,
    int SpeedModifier,
    int FlightTimeModifier,
    int RangeModifier,
    int Price,
    int Stock,
    string Rarity);

/// <summary>
/// Демонстрационный каталог. Его можно заменить загрузкой из базы данных,
/// не меняя Razor-разметку экрана конструктора.
/// </summary>
public static class DroneCatalog
{
    public static IReadOnlyList<DronePart> Parts { get; } = new List<DronePart>
    {
        // Корпуса
        new("frame-light", "frame", "Лёгкий корпус", "Универсальная лёгкая рама", "frame", 2.0m, 0, 0, 0, 80, 4, "Стандарт"),
        new("frame-heavy", "frame", "Прочный корпус", "Усиленная защита оборудования", "frame", 4.0m, -6, 1, 60, 105, 2, "Стандарт"),
        new("frame-carbon", "frame", "Углепластиковый", "Малая масса и высокая скорость", "frame", 1.5m, 8, -1, 0, 160, 1, "Редкий"),

        // Двигатели. При покупке/сборке используется комплект из 4 штук.
        new("motor-base", "motor", "Стандартный мотор", "Надёжная тяга для разных задач", "motor", 0.85m, 0, 0, 0, 20, 8, "Стандарт"),
        new("motor-race", "motor", "Гоночный мотор", "Высокие обороты и ускорение", "motor", 0.95m, 20, -1, -80, 38, 8, "Улучшенный"),
        new("motor-eco", "motor", "Экономичный мотор", "Экономия заряда в долгом полёте", "motor", 0.70m, -7, 2, 200, 30, 8, "Улучшенный"),

        // Пропеллеры. Для сборки нужно 4 штуки.
        new("prop-base", "propeller", "Классический винт", "Стабильный полёт и управляемость", "propeller", 0.45m, 0, 0, 0, 10, 16, "Стандарт"),
        new("prop-sport", "propeller", "Скоростной винт", "Для резких манёвров", "propeller", 0.35m, 13, -1, -100, 22, 12, "Улучшенный"),
        new("prop-quiet", "propeller", "Тихий винт", "Низкая шумность", "propeller", 0.50m, -4, 1, 120, 14, 8, "Стандарт"),

        // Аккумуляторы
        new("battery-base", "battery", "Аккумулятор Li-ion", "Сбалансированный источник питания", "battery", 4.10m, 0, 0, 0, 65, 5, "Стандарт"),
        new("battery-long", "battery", "Ёмкий аккумулятор", "Больше времени в воздухе", "battery", 5.00m, -6, 4, 700, 135, 2, "Улучшенный"),
        new("battery-light", "battery", "Лёгкий аккумулятор", "Для коротких быстрых вылетов", "battery", 2.60m, 9, -2, -150, 80, 3, "Стандарт"),

        // Электроника
        new("chip-base", "electronics", "Контроллер полёта", "Стабилизация и базовая навигация", "electronics", 0.70m, 0, 0, 0, 35, 4, "Стандарт"),
        new("chip-nav", "electronics", "GPS-контроллер", "Точная навигация и маршрут", "electronics", 0.80m, -1, 1, 350, 75, 2, "Улучшенный"),
        new("chip-ai", "electronics", "Умный контроллер", "Обработка данных на борту", "electronics", 0.90m, 4, -1, 80, 95, 1, "Редкий")
    };
}
