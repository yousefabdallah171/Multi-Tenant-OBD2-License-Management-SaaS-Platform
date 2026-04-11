<!DOCTYPE html>
<html lang="{{ $lang }}" dir="{{ $lang === 'ar' ? 'rtl' : 'ltr' }}">
<head>
    <meta charset="utf-8">
    <style>
        @page {
            size: A4 landscape;
            margin: 18px;
        }

        body {
            font-family: DejaVu Sans, sans-serif;
            color: #0f172a;
            font-size: 11px;
            line-height: 1.35;
            margin: 0;
        }

        .header {
            border-bottom: 2px solid #0ea5e9;
            margin-bottom: 18px;
            padding-bottom: 12px;
        }

        .title {
            font-size: 22px;
            font-weight: 700;
            margin: 0 0 4px;
        }

        .meta {
            color: #475569;
            font-size: 11px;
            margin: 0;
        }

        .summary {
            margin: 18px 0;
            width: 100%;
        }

        .summary td {
            border: 1px solid #cbd5e1;
            padding: 8px 10px;
            width: 50%;
        }

        .summary-label {
            color: #475569;
            font-size: 11px;
        }

        .summary-value {
            display: block;
            font-size: 15px;
            font-weight: 700;
            margin-top: 4px;
        }

        .section {
            margin-top: 20px;
        }

        .section-title {
            color: #0f172a;
            font-size: 14px;
            font-weight: 700;
            margin: 0 0 8px;
        }

        table.data {
            border-collapse: collapse;
            width: 100%;
            table-layout: fixed;
        }

        table.data th,
        table.data td {
            border: 1px solid #cbd5e1;
            padding: 6px;
            text-align: {{ $lang === 'ar' ? 'right' : 'left' }};
            vertical-align: top;
            word-break: break-word;
            overflow-wrap: anywhere;
        }

        table.data th {
            background: #e0f2fe;
            color: #0c4a6e;
            font-weight: 700;
            font-size: 10px;
        }

        table.data td {
            font-size: 10px;
        }

        table.data tbody tr:nth-child(even) {
            background: #f8fafc;
        }

        .footer {
            border-top: 1px solid #cbd5e1;
            color: #64748b;
            font-size: 10px;
            margin-top: 20px;
            padding-top: 10px;
            text-align: center;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1 class="title">{{ $title }}</h1>
        @if ($dateRange)
            <p class="meta">{{ $dateRange }}</p>
        @endif
        <p class="meta">{{ $generatedAt->format('Y-m-d H:i') }}</p>
    </div>

    @if (! empty($summary))
        <table class="summary">
            <tr>
                @foreach ($summary as $label => $value)
                    <td>
                        <span class="summary-label">{{ $label }}</span>
                        <span class="summary-value">{{ $value }}</span>
                    </td>
                    @if (($loop->iteration % 2) === 0 && ! $loop->last)
                        </tr><tr>
                    @endif
                @endforeach
            </tr>
        </table>
    @endif

    @foreach ($sections as $section)
        <div class="section">
            @if (! empty($section['title']))
                <h2 class="section-title">{{ $section['title'] }}</h2>
            @endif

            <table class="data">
                <thead>
                    <tr>
                        @foreach ($section['headers'] as $header)
                            <th>{{ $header }}</th>
                        @endforeach
                    </tr>
                </thead>
                <tbody>
                    @forelse ($section['rows'] as $row)
                        <tr>
                            @foreach ($row as $cell)
                                <td>{{ $cell }}</td>
                            @endforeach
                        </tr>
                    @empty
                        <tr>
                            <td colspan="{{ count($section['headers']) }}">No data</td>
                        </tr>
                    @endforelse
                </tbody>
            </table>
        </div>
    @endforeach

    <div class="footer">
        Generated on {{ $generatedAt->format('Y-m-d H:i') }}
    </div>
</body>
</html>
