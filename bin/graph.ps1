# graph.ps1 — knowledge graph CLI (Windows/PowerShell)
param(
    [Parameter(Position=0)] [string]$Subcommand = "",
    [Parameter(Position=1)] [string]$Arg1 = "",
    [Parameter(Position=2)] [string]$Arg2 = "",
    [Parameter(Position=3)] [string]$Arg3 = ""
)

$Api = if ($env:BOARD_API) { "$($env:BOARD_API)/api/graph" } else { "http://localhost:4200/api/graph" }

function Invoke-Api($Method, $Url, $Body = $null) {
    $params = @{ Uri = $Url; Method = $Method; ContentType = "application/json" }
    if ($Body) { $params.Body = ($Body | ConvertTo-Json -Compress) }
    try { Invoke-RestMethod @params } catch { Write-Error $_.Exception.Message; exit 1 }
}

switch ($Subcommand) {
    "add" {
        if (-not $Arg1 -or -not $Arg2) { Write-Error "Usage: graph add <type> <name>"; exit 1 }
        $result = Invoke-Api "POST" $Api @{ type = $Arg1; name = $Arg2 }
        Write-Output $result.id
    }
    "search" {
        if (-not $Arg1) { Write-Error "Usage: graph search <query>"; exit 1 }
        $encoded = [System.Uri]::EscapeDataString($Arg1)
        $results = Invoke-Api "GET" "$Api/search?q=$encoded"
        $results | Format-Table -Property @{L="ID";E={$_.id.Substring(0,[Math]::Min(8,$_.id.Length))}}, type, name, @{L="Summary";E={if($_.summary){$_.summary.Substring(0,[Math]::Min(60,$_.summary.Length))}else{""}}} -AutoSize
    }
    "get" {
        if (-not $Arg1) { Write-Error "Usage: graph get <id>"; exit 1 }
        Write-Output "=== Entity ==="
        Invoke-Api "GET" "$Api/$Arg1" | ConvertTo-Json -Depth 10
        Write-Output "`n=== Neighbors ==="
        Invoke-Api "GET" "$Api/$Arg1/neighbors" | ConvertTo-Json -Depth 10
    }
    "relate" {
        if (-not $Arg1 -or -not $Arg2 -or -not $Arg3) { Write-Error "Usage: graph relate <id1> <relation> <id2>"; exit 1 }
        $result = Invoke-Api "POST" "$Api/relations" @{ from_id = $Arg1; relation = $Arg2; to_id = $Arg3 }
        Write-Output $result.id
    }
    default {
        Write-Output "Usage: graph <subcommand> [args]"
        Write-Output ""
        Write-Output "Subcommands:"
        Write-Output "  add <type> <name>              Create a new entity"
        Write-Output "  search <query>                 Search entities by full-text query"
        Write-Output "  get <id>                       Print entity JSON and neighbors"
        Write-Output "  relate <id1> <relation> <id2>  Create a relation between entities"
        exit 1
    }
}
