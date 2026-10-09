using System.Drawing.Drawing2D;

namespace AdegaPDV.Launcher;

/// <summary>
/// Tela de inicialização desenhada inteiramente em GDI+.
/// Sem imagens externas, sem dependências extras e responsiva ao tamanho da janela.
/// </summary>
internal sealed class LoadingExperience : Control
{
    private readonly System.Windows.Forms.Timer animationTimer = new();

    private float targetProgress = 8f;
    private float currentProgress = 0f;
    private float animationPhase = 0f;

    private string stepText = "Iniciando ambiente seguro...";
    private string detailText = "Preparando o Adega PDV para você";
    private readonly string version;

    private readonly Font brandFont =
        new("Segoe UI", 22f, FontStyle.Bold, GraphicsUnit.Pixel);

    private readonly Font heroFont =
        new("Segoe UI", 31f, FontStyle.Bold, GraphicsUnit.Pixel);

    private readonly Font subtitleFont =
        new("Segoe UI", 14f, FontStyle.Regular, GraphicsUnit.Pixel);

    private readonly Font statusFont =
        new("Segoe UI", 13f, FontStyle.Bold, GraphicsUnit.Pixel);

    private readonly Font smallFont =
        new("Segoe UI", 11f, FontStyle.Regular, GraphicsUnit.Pixel);

    private readonly Font tinyFont =
        new("Segoe UI", 10f, FontStyle.Bold, GraphicsUnit.Pixel);

    private readonly Font percentFont =
        new("Segoe UI", 16f, FontStyle.Bold, GraphicsUnit.Pixel);

    public LoadingExperience(string appVersion)
    {
        version = appVersion;

        Dock = DockStyle.Fill;
        BackColor = Color.FromArgb(4, 10, 20);

        SetStyle(
            ControlStyles.AllPaintingInWmPaint |
            ControlStyles.UserPaint |
            ControlStyles.OptimizedDoubleBuffer |
            ControlStyles.ResizeRedraw,
            true
        );

        animationTimer.Interval = 16;
        animationTimer.Tick += (_, _) =>
        {
            animationPhase += 0.024f;

            if (animationPhase > MathF.PI * 200f)
            {
                animationPhase = 0f;
            }

            float delta =
                targetProgress -
                currentProgress;

            if (MathF.Abs(delta) > 0.02f)
            {
                currentProgress +=
                    delta * 0.075f;

                if (
                    MathF.Abs(
                        targetProgress -
                        currentProgress
                    ) < 0.08f
                )
                {
                    currentProgress =
                        targetProgress;
                }
            }

            Invalidate();
        };

        animationTimer.Start();
    }

    public void SetStep(
        string step,
        int progress,
        string? detail = null
    )
    {
        if (!string.IsNullOrWhiteSpace(step))
        {
            stepText = step.Trim();
        }

        if (!string.IsNullOrWhiteSpace(detail))
        {
            detailText = detail.Trim();
        }

        targetProgress =
            Math.Max(
                targetProgress,
                Math.Clamp(
                    progress,
                    0,
                    100
                )
            );

        Invalidate();
    }

    protected override void Dispose(
        bool disposing
    )
    {
        if (disposing)
        {
            animationTimer.Stop();
            animationTimer.Dispose();

            brandFont.Dispose();
            heroFont.Dispose();
            subtitleFont.Dispose();
            statusFont.Dispose();
            smallFont.Dispose();
            tinyFont.Dispose();
            percentFont.Dispose();
        }

        base.Dispose(disposing);
    }

    protected override void OnPaint(
        PaintEventArgs e
    )
    {
        base.OnPaint(e);

        Graphics g = e.Graphics;

        g.SmoothingMode =
            SmoothingMode.AntiAlias;

        g.PixelOffsetMode =
            PixelOffsetMode.HighQuality;

        Rectangle bounds =
            ClientRectangle;

        if (
            bounds.Width <= 1 ||
            bounds.Height <= 1
        )
        {
            return;
        }

        DrawBackground(
            g,
            bounds
        );

        DrawAmbientGrid(
            g,
            bounds
        );

        DrawTopBrand(
            g,
            bounds
        );

        DrawMainCard(
            g,
            bounds
        );

        DrawFooter(
            g,
            bounds
        );
    }

    private void DrawBackground(
        Graphics g,
        Rectangle bounds
    )
    {
        using (
            var gradient =
                new LinearGradientBrush(
                    bounds,
                    Color.FromArgb(
                        3,
                        9,
                        20
                    ),
                    Color.FromArgb(
                        7,
                        20,
                        38
                    ),
                    132f
                )
        )
        {
            g.FillRectangle(
                gradient,
                bounds
            );
        }

        float swayX =
            MathF.Sin(
                animationPhase * 0.7f
            ) * 38f;

        float swayY =
            MathF.Cos(
                animationPhase * 0.55f
            ) * 26f;

        DrawGlow(
            g,
            new RectangleF(
                bounds.Width * 0.08f + swayX,
                bounds.Height * 0.05f + swayY,
                bounds.Width * 0.42f,
                bounds.Width * 0.42f
            ),
            Color.FromArgb(
                33,
                35,
                119,
                255
            )
        );

        DrawGlow(
            g,
            new RectangleF(
                bounds.Width * 0.63f - swayX * 0.55f,
                bounds.Height * 0.48f - swayY,
                bounds.Width * 0.34f,
                bounds.Width * 0.34f
            ),
            Color.FromArgb(
                25,
                0,
                221,
                180
            )
        );

        DrawGlow(
            g,
            new RectangleF(
                bounds.Width * 0.50f,
                -bounds.Height * 0.18f,
                bounds.Width * 0.26f,
                bounds.Width * 0.26f
            ),
            Color.FromArgb(
                18,
                123,
                73,
                255
            )
        );
    }

    private static void DrawGlow(
        Graphics g,
        RectangleF rect,
        Color color
    )
    {
        using var path =
            new GraphicsPath();

        path.AddEllipse(rect);

        using var brush =
            new PathGradientBrush(
                path
            );

        brush.CenterColor =
            color;

        brush.SurroundColors =
            new[]
            {
                Color.FromArgb(
                    0,
                    color.R,
                    color.G,
                    color.B
                )
            };

        g.FillEllipse(
            brush,
            rect
        );
    }

    private void DrawAmbientGrid(
        Graphics g,
        Rectangle bounds
    )
    {
        using var pen =
            new Pen(
                Color.FromArgb(
                    12,
                    123,
                    171,
                    220
                ),
                1f
            );

        const int spacing = 44;

        int xOffset =
            (int)(
                animationPhase * 7f
            ) % spacing;

        for (
            int x = -spacing + xOffset;
            x < bounds.Width;
            x += spacing
        )
        {
            g.DrawLine(
                pen,
                x,
                0,
                x,
                bounds.Height
            );
        }

        int yOffset =
            (int)(
                animationPhase * 4f
            ) % spacing;

        for (
            int y = -spacing + yOffset;
            y < bounds.Height;
            y += spacing
        )
        {
            g.DrawLine(
                pen,
                0,
                y,
                bounds.Width,
                y
            );
        }

        // Pontos discretos dão profundidade sem poluir.
        using var dotBrush =
            new SolidBrush(
                Color.FromArgb(
                    42,
                    91,
                    190,
                    255
                )
            );

        for (int i = 0; i < 16; i++)
        {
            double phase =
                animationPhase *
                (
                    0.35 +
                    (i % 5) * 0.045
                ) +
                i * 1.37;

            float px =
                (
                    i * 131 +
                    73
                ) %
                Math.Max(
                    1,
                    bounds.Width
                );

            px +=
                (float)Math.Sin(
                    phase
                ) * 18f;

            float py =
                (
                    i * 79 +
                    41
                ) %
                Math.Max(
                    1,
                    bounds.Height
                );

            py +=
                (float)Math.Cos(
                    phase * 0.9
                ) * 14f;

            float size =
                2f +
                (i % 3);

            g.FillEllipse(
                dotBrush,
                px,
                py,
                size,
                size
            );
        }
    }

    private void DrawTopBrand(
        Graphics g,
        Rectangle bounds
    )
    {
        const int margin = 34;

        RectangleF logoRect =
            new(
                margin,
                28,
                42,
                42
            );

        DrawRoundedGradient(
            g,
            logoRect,
            12f,
            Color.FromArgb(
                30,
                122,
                255
            ),
            Color.FromArgb(
                0,
                211,
                184
            )
        );

        using var logoFont =
            new Font(
                "Segoe UI",
                14f,
                FontStyle.Bold,
                GraphicsUnit.Pixel
            );

        DrawCenteredText(
            g,
            "AP",
            logoFont,
            Color.White,
            logoRect
        );

        using var white =
            new SolidBrush(
                Color.FromArgb(
                    241,
                    247,
                    255
                )
            );

        g.DrawString(
            "ADEGA PDV",
            brandFont,
            white,
            new PointF(
                logoRect.Right + 12,
                logoRect.Top + 2
            )
        );

        using var brandCaptionFont =
            new Font(
                "Segoe UI",
                9.5f,
                FontStyle.Regular,
                GraphicsUnit.Pixel
            );

        using var muted =
            new SolidBrush(
                Color.FromArgb(
                    124,
                    147,
                    173
                )
            );

        g.DrawString(
            "local commerce operating system",
            brandCaptionFont,
            muted,
            new PointF(
                logoRect.Right + 13,
                logoRect.Top + 24
            )
        );

        string badge =
            $"v{version}  •  LOCAL";

        SizeF badgeSize =
            g.MeasureString(
                badge,
                tinyFont
            );

        RectangleF badgeRect =
            new(
                bounds.Width -
                    margin -
                    badgeSize.Width -
                    24,
                34,
                badgeSize.Width + 24,
                28
            );

        using var badgeBrush =
            new SolidBrush(
                Color.FromArgb(
                    30,
                    30,
                    57,
                    83
                )
            );

        using var badgePen =
            new Pen(
                Color.FromArgb(
                    55,
                    97,
                    137,
                    178
                )
            );

        using var badgePath =
            RoundedRect(
                badgeRect,
                14f
            );

        g.FillPath(
            badgeBrush,
            badgePath
        );

        g.DrawPath(
            badgePen,
            badgePath
        );

        using var badgeTextBrush =
            new SolidBrush(
                Color.FromArgb(
                    155,
                    188,
                    220
                )
            );

        g.DrawString(
            badge,
            tinyFont,
            badgeTextBrush,
            new PointF(
                badgeRect.Left + 12,
                badgeRect.Top + 7
            )
        );
    }

    private void DrawMainCard(
        Graphics g,
        Rectangle bounds
    )
    {
        float cardWidth =
            Math.Min(
                760f,
                Math.Max(
                    580f,
                    bounds.Width * 0.57f
                )
            );

        float cardHeight =
            Math.Min(
                470f,
                Math.Max(
                    410f,
                    bounds.Height * 0.56f
                )
            );

        RectangleF card =
            new(
                (
                    bounds.Width -
                    cardWidth
                ) / 2f,
                (
                    bounds.Height -
                    cardHeight
                ) / 2f + 18f,
                cardWidth,
                cardHeight
            );

        DrawCardShadow(
            g,
            card
        );

        using var cardPath =
            RoundedRect(
                card,
                28f
            );

        using var cardBrush =
            new LinearGradientBrush(
                card,
                Color.FromArgb(
                    236,
                    11,
                    25,
                    43
                ),
                Color.FromArgb(
                    244,
                    8,
                    19,
                    34
                ),
                105f
            );

        g.FillPath(
            cardBrush,
            cardPath
        );

        using var borderPen =
            new Pen(
                Color.FromArgb(
                    64,
                    110,
                    151,
                    194
                ),
                1f
            );

        g.DrawPath(
            borderPen,
            cardPath
        );

        float left =
            card.Left + 46f;

        float right =
            card.Right - 46f;

        float top =
            card.Top + 38f;

        DrawHero(
            g,
            left,
            right,
            top
        );

        float progressY =
            card.Top + 210f;

        DrawProgressSection(
            g,
            left,
            right,
            progressY
        );

        float stagesY =
            card.Bottom - 110f;

        DrawStages(
            g,
            left,
            right,
            stagesY
        );
    }

    private void DrawHero(
        Graphics g,
        float left,
        float right,
        float top
    )
    {
        RectangleF icon =
            new(
                left,
                top,
                70,
                70
            );

        DrawRoundedGradient(
            g,
            icon,
            22f,
            Color.FromArgb(
                27,
                117,
                255
            ),
            Color.FromArgb(
                0,
                217,
                178
            )
        );

        // Halo pulsante.
        float pulse =
            (
                MathF.Sin(
                    animationPhase * 2.4f
                ) +
                1f
            ) / 2f;

        using var haloPen =
            new Pen(
                Color.FromArgb(
                    28 +
                    (int)(pulse * 20),
                    73,
                    152,
                    255
                ),
                1.3f
            );

        RectangleF halo =
            icon;

        halo.Inflate(
            7f + pulse * 3f,
            7f + pulse * 3f
        );

        using var haloPath =
            RoundedRect(
                halo,
                26f
            );

        g.DrawPath(
            haloPen,
            haloPath
        );

        using var logoFont =
            new Font(
                "Segoe UI",
                22f,
                FontStyle.Bold,
                GraphicsUnit.Pixel
            );

        DrawCenteredText(
            g,
            "AP",
            logoFont,
            Color.White,
            icon
        );

        using var titleBrush =
            new SolidBrush(
                Color.FromArgb(
                    244,
                    248,
                    255
                )
            );

        g.DrawString(
            "Seu PDV está ficando pronto.",
            heroFont,
            titleBrush,
            new PointF(
                left + 92f,
                top + 2f
            )
        );

        using var subtitleBrush =
            new SolidBrush(
                Color.FromArgb(
                    135,
                    157,
                    183
                )
            );

        g.DrawString(
            detailText,
            subtitleFont,
            subtitleBrush,
            new RectangleF(
                left + 93f,
                top + 43f,
                right -
                    left -
                    93f,
                42f
            )
        );

        DrawStatusChip(
            g,
            left,
            top + 102f
        );
    }

    private void DrawStatusChip(
        Graphics g,
        float left,
        float y
    )
    {
        SizeF text =
            g.MeasureString(
                stepText,
                statusFont
            );

        RectangleF chip =
            new(
                left,
                y,
                Math.Min(
                    470f,
                    text.Width + 58f
                ),
                34f
            );

        using var chipPath =
            RoundedRect(
                chip,
                17f
            );

        using var chipBrush =
            new SolidBrush(
                Color.FromArgb(
                    40,
                    34,
                    81,
                    125
                )
            );

        using var chipPen =
            new Pen(
                Color.FromArgb(
                    74,
                    70,
                    150,
                    227
                )
            );

        g.FillPath(
            chipBrush,
            chipPath
        );

        g.DrawPath(
            chipPen,
            chipPath
        );

        float dotX =
            chip.Left + 17f;

        float dotY =
            chip.Top + 17f;

        float pulse =
            (
                MathF.Sin(
                    animationPhase * 4.2f
                ) +
                1f
            ) / 2f;

        using var pulseBrush =
            new SolidBrush(
                Color.FromArgb(
                    35 +
                    (int)(
                        pulse * 45
                    ),
                    60,
                    175,
                    255
                )
            );

        g.FillEllipse(
            pulseBrush,
            dotX - 7f,
            dotY - 7f,
            14f,
            14f
        );

        using var dotBrush =
            new SolidBrush(
                Color.FromArgb(
                    87,
                    193,
                    255
                )
            );

        g.FillEllipse(
            dotBrush,
            dotX - 3.5f,
            dotY - 3.5f,
            7f,
            7f
        );

        using var textBrush =
            new SolidBrush(
                Color.FromArgb(
                    186,
                    224,
                    255
                )
            );

        g.DrawString(
            stepText,
            statusFont,
            textBrush,
            new PointF(
                chip.Left + 33f,
                chip.Top + 8f
            )
        );
    }

    private void DrawProgressSection(
        Graphics g,
        float left,
        float right,
        float y
    )
    {
        int percentage =
            Math.Clamp(
                (int)MathF.Round(
                    currentProgress
                ),
                0,
                100
            );

        using var muted =
            new SolidBrush(
                Color.FromArgb(
                    116,
                    142,
                    171
                )
            );

        g.DrawString(
            "PROGRESSO DA INICIALIZAÇÃO",
            tinyFont,
            muted,
            new PointF(
                left,
                y
            )
        );

        string percentText =
            $"{percentage}%";

        SizeF percentSize =
            g.MeasureString(
                percentText,
                percentFont
            );

        using var percentBrush =
            new SolidBrush(
                Color.FromArgb(
                    222,
                    239,
                    255
                )
            );

        g.DrawString(
            percentText,
            percentFont,
            percentBrush,
            new PointF(
                right -
                    percentSize.Width,
                y - 4f
            )
        );

        RectangleF track =
            new(
                left,
                y + 34f,
                right - left,
                9f
            );

        using var trackPath =
            RoundedRect(
                track,
                4.5f
            );

        using var trackBrush =
            new SolidBrush(
                Color.FromArgb(
                    48,
                    34,
                    54,
                    76
                )
            );

        g.FillPath(
            trackBrush,
            trackPath
        );

        float fillWidth =
            track.Width *
            Math.Clamp(
                currentProgress,
                0f,
                100f
            ) /
            100f;

        if (fillWidth > 2f)
        {
            RectangleF fill =
                new(
                    track.Left,
                    track.Top,
                    fillWidth,
                    track.Height
                );

            using var fillPath =
                RoundedRect(
                    fill,
                    4.5f
                );

            using var fillBrush =
                new LinearGradientBrush(
                    track,
                    Color.FromArgb(
                        52,
                        136,
                        255
                    ),
                    Color.FromArgb(
                        0,
                        224,
                        184
                    ),
                    0f
                );

            g.FillPath(
                fillBrush,
                fillPath
            );

            float shimmerWidth = 70f;

            float shimmerX =
                track.Left -
                shimmerWidth +
                (
                    (
                        animationPhase *
                        76f
                    ) %
                    (
                        track.Width +
                        shimmerWidth * 2f
                    )
                );

            RectangleF shimmer =
                new(
                    shimmerX,
                    track.Top - 2f,
                    shimmerWidth,
                    track.Height + 4f
                );

            if (
                shimmer.Right >
                    fill.Left &&
                shimmer.Left <
                    fill.Right
            )
            {
                using var shimmerBrush =
                    new LinearGradientBrush(
                        shimmer,
                        Color.FromArgb(
                            0,
                            255,
                            255,
                            255
                        ),
                        Color.FromArgb(
                            130,
                            255,
                            255,
                            255
                        ),
                        0f
                    );

                var oldClip =
                    g.Clip;

                using var clip =
                    new Region(
                        fillPath
                    );

                g.SetClip(
                    clip,
                    CombineMode.Intersect
                );

                g.FillRectangle(
                    shimmerBrush,
                    shimmer
                );

                g.Clip =
                    oldClip;
            }
        }

        using var hintBrush =
            new SolidBrush(
                Color.FromArgb(
                    91,
                    115,
                    143
                )
            );

        g.DrawString(
            "Inicialização protegida • dados locais preservados",
            smallFont,
            hintBrush,
            new PointF(
                left,
                y + 55f
            )
        );
    }

    private void DrawStages(
        Graphics g,
        float left,
        float right,
        float y
    )
    {
        string[] labels =
        {
            "Sistema",
            "Servidor",
            "Interface",
            "Pronto"
        };

        int[] thresholds =
        {
            20,
            52,
            82,
            100
        };

        float usable =
            right - left;

        float segment =
            usable /
            (
                labels.Length - 1
            );

        using var linePen =
            new Pen(
                Color.FromArgb(
                    51,
                    50,
                    77,
                    103
                ),
                2f
            );

        g.DrawLine(
            linePen,
            left,
            y + 10f,
            right,
            y + 10f
        );

        for (
            int i = 0;
            i < labels.Length;
            i++
        )
        {
            float x =
                left +
                segment * i;

            bool reached =
                currentProgress >=
                thresholds[i] - 1;

            bool active =
                !reached &&
                (
                    i == 0 ||
                    currentProgress >=
                        thresholds[
                            i - 1
                        ] - 1
                );

            Color fill =
                reached
                    ? Color.FromArgb(
                        0,
                        213,
                        174
                    )
                    : active
                        ? Color.FromArgb(
                            69,
                            149,
                            255
                        )
                        : Color.FromArgb(
                            37,
                            58,
                            80
                        );

            float radius =
                active
                    ? 7f +
                        (
                            MathF.Sin(
                                animationPhase *
                                3.5f
                            ) +
                            1f
                        ) *
                        1.1f
                    : 6f;

            if (active)
            {
                using var halo =
                    new SolidBrush(
                        Color.FromArgb(
                            34,
                            fill.R,
                            fill.G,
                            fill.B
                        )
                    );

                g.FillEllipse(
                    halo,
                    x - 12f,
                    y - 2f,
                    24f,
                    24f
                );
            }

            using var dot =
                new SolidBrush(
                    fill
                );

            g.FillEllipse(
                dot,
                x - radius,
                y + 10f - radius,
                radius * 2f,
                radius * 2f
            );

            SizeF labelSize =
                g.MeasureString(
                    labels[i],
                    smallFont
                );

            using var text =
                new SolidBrush(
                    reached ||
                    active
                        ? Color.FromArgb(
                            183,
                            205,
                            228
                        )
                        : Color.FromArgb(
                            79,
                            103,
                            129
                        )
                );

            g.DrawString(
                labels[i],
                smallFont,
                text,
                new PointF(
                    x -
                    labelSize.Width /
                    2f,
                    y + 30f
                )
            );
        }
    }

    private void DrawFooter(
        Graphics g,
        Rectangle bounds
    )
    {
        string footer =
            "AMBIENTE LOCAL  •  PRIVACIDADE POR PADRÃO  •  ADEGA PDV";

        SizeF size =
            g.MeasureString(
                footer,
                tinyFont
            );

        using var brush =
            new SolidBrush(
                Color.FromArgb(
                    67,
                    94,
                    124
                )
            );

        g.DrawString(
            footer,
            tinyFont,
            brush,
            new PointF(
                (
                    bounds.Width -
                    size.Width
                ) / 2f,
                bounds.Height - 38f
            )
        );
    }

    private static void DrawCardShadow(
        Graphics g,
        RectangleF card
    )
    {
        for (
            int i = 18;
            i >= 1;
            i -= 3
        )
        {
            RectangleF shadow =
                card;

            shadow.Inflate(
                i,
                i
            );

            shadow.Offset(
                0,
                7
            );

            using var path =
                RoundedRect(
                    shadow,
                    28f + i
                );

            using var brush =
                new SolidBrush(
                    Color.FromArgb(
                        Math.Max(
                            1,
                            16 - i / 2
                        ),
                        0,
                        0,
                        0
                    )
                );

            g.FillPath(
                brush,
                path
            );
        }
    }

    private static void DrawRoundedGradient(
        Graphics g,
        RectangleF rect,
        float radius,
        Color start,
        Color end
    )
    {
        using var path =
            RoundedRect(
                rect,
                radius
            );

        using var brush =
            new LinearGradientBrush(
                rect,
                start,
                end,
                38f
            );

        g.FillPath(
            brush,
            path
        );
    }

    private static void DrawCenteredText(
        Graphics g,
        string text,
        Font font,
        Color color,
        RectangleF rect
    )
    {
        using var brush =
            new SolidBrush(
                color
            );

        using var format =
            new StringFormat
            {
                Alignment =
                    StringAlignment.Center,
                LineAlignment =
                    StringAlignment.Center
            };

        g.DrawString(
            text,
            font,
            brush,
            rect,
            format
        );
    }

    private static GraphicsPath RoundedRect(
        RectangleF bounds,
        float radius
    )
    {
        float diameter =
            Math.Max(
                1f,
                radius * 2f
            );

        diameter =
            Math.Min(
                diameter,
                Math.Min(
                    bounds.Width,
                    bounds.Height
                )
            );

        RectangleF arc =
            new(
                bounds.X,
                bounds.Y,
                diameter,
                diameter
            );

        var path =
            new GraphicsPath();

        path.AddArc(
            arc,
            180,
            90
        );

        arc.X =
            bounds.Right -
            diameter;

        path.AddArc(
            arc,
            270,
            90
        );

        arc.Y =
            bounds.Bottom -
            diameter;

        path.AddArc(
            arc,
            0,
            90
        );

        arc.X =
            bounds.Left;

        path.AddArc(
            arc,
            90,
            90
        );

        path.CloseFigure();

        return path;
    }
}
