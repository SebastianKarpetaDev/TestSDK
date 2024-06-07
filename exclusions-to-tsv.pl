#!/usr/bin/env perl

use strict;
use warnings;
use LWP::Simple;
use File::Slurp;

my $url = 'https://termbin.com/wtvr';
my $filename_output = 'tests.tsv';

my @content_array;
my $content_line;

my $filename_input = shift;
if ($filename_input)
{
  $content_line = read_file($filename_input, { binmode => ':raw', atomic => 1 });
  unless (defined($content_line)) {die "Could not read from file $filename_input\n$!\n";}
} else
{
  print "File name not specified as a command line parameter. Using onine data from the URL.\nFetching $url\n";
  $content_line = get($url);
  unless (defined($content_line)) {die "Could not get $url\n$!\n";}
}

my @output;
@content_array = split chr(10), $content_line;
undef $content_line;

my $counter=0;
my $testtype="False positive";

my $firstline="Test class\tTest name\tTest condition\tBrowsers\tSource file name\tSource line";
push @output, $firstline;
undef $firstline;

foreach (@content_array)
{
    $counter++;
    if (/^\s*SDK tests:\s*$/)
    {
        $testtype = "SDK";
    } elsif (/^\s*([A-Za-z0-9\._-]+)\s*\|\s*([A-Za-z0-9\., _\(\):-]+)\s*\|\s([a-z-, ]*)\s*\|\s*([\/\\[A-Za-z0-9_\.-]+)\:(\d+)/)
    {
        my @matches = ($testtype, $1,$2,$3,$4,$5);
        for my $i (0..$#matches) {
        # Trim trailing whitespace from all elements of @matches
            $matches[$i] =~ s/\s+$//;
        # Trim trailing parentheses 
            $matches[$i] =~ s/\)$//;
        }
        my $matches_joined = join("\t", @matches);
	push @output, $matches_joined;
    }
    else
    {
        print "Line $counter does not match\n";
    }
}

my $output_line = join("\n", @output);
undef @output;

write_file($filename_output, { binmode => ':raw', atomic => 1 }, $output_line);
print "Written to $filename_output\n";

